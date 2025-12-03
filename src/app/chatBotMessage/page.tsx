// filepath: src/app/chatBotMessage/page.tsx
'use client';

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type FormEvent,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { ChatMessageEntry } from '@/shared/chatMessage';
import { adaptInChatMessage } from '@/shared/chatMessage';
import { useOwnerIdValue } from '@/shared/core/owner';
import { postJson } from '@/shared/core/apiClient';
import {
    joinChatRoomUser,
    type JoinChatRoomUserInput,
} from '@/shared/chatRoom/api/queries';

const API_BASE_RAW = process.env.NEXT_PUBLIC_API_BASE ?? '';
const API_BASE = API_BASE_RAW.replace(/\/+$/, '');
const WS_ENDPOINT =
    (API_BASE && `${API_BASE}/ws-stomp`) || 'http://localhost:8080/ws-stomp';

const TOPIC_PREFIX = '/topic/chat-bot/';
const SEND_PREFIX = '/app/chat-bot/';

const API_SELECT_MESSAGE_LIST =
    '/api/cht/chatMessage/selectChatMessageList';

const PAGE_MAX_WIDTH = 480;

const isRec = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null;

function unwrapList(v: unknown): unknown {
    if (Array.isArray(v)) return v;
    if (isRec(v) && Array.isArray(v['result'])) return v['result'];
    if (isRec(v) && Array.isArray(v['rows'])) return v['rows'];
    if (isRec(v) && Array.isArray(v['list'])) return v['list'];
    return v;
}

function extractMessageList(v: unknown): ChatMessageEntry[] {
    let cur: unknown = v;
    for (let i = 0; i < 5; i += 1) {
        const list = unwrapList(cur);
        if (Array.isArray(list)) {
            return list.map((row) => adaptInChatMessage(row));
        }
        if (
            isRec(cur) &&
            (isRec(cur['result']) || isRec(cur['data']) || isRec(cur['item']))
        ) {
            cur =
                (cur['result'] as unknown) ||
                (cur['data'] as unknown) ||
                (cur['item'] as unknown);
            continue;
        }
        break;
    }
    return [];
}

async function fetchMessageHistory(
    roomId: number,
): Promise<ChatMessageEntry[]> {
    const payload: Record<string, unknown> = { roomId, limit: 50 };
    const data = await postJson<unknown>(API_SELECT_MESSAGE_LIST, payload);
    return extractMessageList(data);
}

// connect_session 쿠키에서 email 추출
function getEmailFromConnectSession(): string | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const cookieStr = document.cookie;
    if (!cookieStr) return null;

    const cookies = cookieStr.split(';');
    const prefix = 'connect_session=';

    for (const part of cookies) {
        const trimmed = part.trim();
        if (!trimmed.startsWith(prefix)) continue;

        const rawVal = trimmed.slice(prefix.length);
        if (!rawVal) return null;

        let decoded: string;
        try {
            decoded = decodeURIComponent(rawVal);
        } catch {
            return null;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(decoded) as unknown;
        } catch {
            return null;
        }

        if (!isRec(parsed)) return null;

        const emailVal = parsed['email'];
        if (typeof emailVal === 'string' && emailVal.trim() !== '') {
            return emailVal;
        }
        return null;
    }

    return null;
}

function createStompClient(): Client {
    const client = new Client({
        webSocketFactory: () =>
            new SockJS(WS_ENDPOINT) as unknown as WebSocket,
        reconnectDelay: 5000,
    });
    return client;
}

type ChatBotMessageSendPayload = {
    roomId: number;
    content: string;
    contentType: 'TEXT';
    ownerId?: number | null;
    senderId?: number | null;
    senderNm?: string | null;
};

export default function ChatBotMessagePage() {
    const searchParams = useSearchParams();
    const ownerId = useOwnerIdValue();

    const rawRoomId = searchParams.get('roomId');
    const parsedRoomId = rawRoomId ? Number(rawRoomId) : Number.NaN;

    // JSP처럼 roomId 파라미터 없으면 기본값 1 사용
    const safeRoomId: number | null = Number.isFinite(parsedRoomId)
        ? parsedRoomId
        : rawRoomId === null
        ? 1
        : null;

    const [messages, setMessages] = useState<ChatMessageEntry[]>([]);
    const [text, setText] = useState('');
    const [connecting, setConnecting] = useState(false);

    const clientRef = useRef<Client | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);

    const roomTitle = useMemo(
        () =>
            safeRoomId !== null
                ? `Qwen 챗봇 방 #${safeRoomId}`
                : 'Qwen 챗봇 방',
        [safeRoomId],
    );

    // 방 입장 + 히스토리 + STOMP 연결
    useEffect(() => {
        if (safeRoomId === null) {
            return;
        }

        if (ownerId === null || ownerId === undefined) {
            return;
        }

        const senderEmail = getEmailFromConnectSession();

        // TB_CHAT_ROOM_USER upsert
        void (async () => {
            try {
                const joinPayload: JoinChatRoomUserInput = {
                    roomId: safeRoomId,
                    userId: ownerId,
                    senderNm: senderEmail ?? null,
                    roleCd: 'MEMBER',
                };
                await joinChatRoomUser(joinPayload);
            } catch {
                // 조용히 무시
            }
        })();

        // 기존 히스토리
        void (async () => {
            try {
                const history = await fetchMessageHistory(safeRoomId);
                setMessages(history);
            } catch {
                // 조용히 무시
            }
        })();

        // STOMP 연결
        const client = createStompClient();
        clientRef.current = client;
        setConnecting(true);

        client.onConnect = () => {
            setConnecting(false);

            const destination = `${TOPIC_PREFIX}${safeRoomId}`;

            client.subscribe(destination, (msg: IMessage) => {
                const bodyStr = msg.body;
                if (typeof bodyStr !== 'string' || bodyStr.trim() === '') {
                    return;
                }

                let parsed: unknown;
                try {
                    parsed = JSON.parse(bodyStr) as unknown;
                } catch {
                    return;
                }
                const entry = adaptInChatMessage(parsed);
                setMessages((prev) => [...prev, entry]);
            });
        };

        client.onStompError = () => {
            setConnecting(false);
        };

        client.onWebSocketError = () => {
            setConnecting(false);
        };

        client.activate();

        return () => {
            clientRef.current = null;
            client.deactivate();
        };
    }, [safeRoomId, ownerId]);

    // 메시지 변경 시 스크롤 맨 아래로
    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [messages.length]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setText(e.target.value);
    };

    const handleSend = (e: FormEvent) => {
        e.preventDefault();

        const trimmed = text.trim();
        if (!trimmed || safeRoomId === null) return;

        const client = clientRef.current;
        if (!client || !client.connected) {
            return;
        }

        const senderId = ownerId ?? null;
        const senderEmail = getEmailFromConnectSession();
        const senderNm: string | null = senderEmail ?? null;

        const payload: ChatBotMessageSendPayload = {
            roomId: safeRoomId,
            content: trimmed,
            contentType: 'TEXT',
            ownerId: ownerId ?? null,
            senderId,
            senderNm,
        };

        client.publish({
            destination: `${SEND_PREFIX}${safeRoomId}`,
            body: JSON.stringify(payload),
        });

        setText('');
    };

    return (
        <div
            style={{
                maxWidth: PAGE_MAX_WIDTH,
                margin: '0 auto',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#e5e5e5',
                border: '1px solid #ddd',
            }}
        >
            {/* 헤더 (엔진 설명 포함) */}
            <div
                style={{
                    padding: '8px 16px',
                    backgroundColor: '#f7f7f7',
                    borderBottom: '1px solid #ddd',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                        }}
                    >
                        {roomTitle}
                    </div>
                    <div
                        style={{
                            fontSize: 12,
                            color: '#888',
                        }}
                    >
                        {safeRoomId === null
                            ? 'roomId 오류'
                            : connecting
                            ? '연결 중…'
                            : '연결 완료'}{' '}
                        · 엔진: QWEN-CHATBOT
                    </div>
                </div>
                <div style={{ fontSize: 20 }}>🤖</div>
            </div>

            {/* 메시지 리스트 */}
            <div
                ref={listRef}
                style={{
                    flex: 1,
                    padding: '12px 10px 8px',
                    overflowY: 'auto',
                    backgroundColor: '#e5e5e5',
                }}
            >
                {messages.length === 0 && (
                    <div
                        style={{
                            marginTop: 40,
                            textAlign: 'center',
                            fontSize: 13,
                            color: '#777',
                        }}
                    >
                        아직 대화가 없습니다. 질문을 입력해 보세요.
                    </div>
                )}

                {messages.map((m) => {
                    const id =
                        m.id ?? m.createdDt ?? Math.random().toString(36);
                    const isMine =
                        ownerId !== null &&
                        ownerId !== undefined &&
                        m.senderId === ownerId;

                    const sender =
                        m.senderNm && m.senderNm.trim() !== ''
                            ? m.senderNm
                            : `USER${m.senderId ?? ''}`;

                    const dt =
                        m.sentDt ??
                        m.updatedDt ??
                        m.createdDt ??
                        '';

                    return (
                        <div
                            key={String(id)}
                            style={{
                                display: 'flex',
                                justifyContent: isMine
                                    ? 'flex-end'
                                    : 'flex-start',
                                marginBottom: 8,
                            }}
                        >
                            {!isMine && (
                                <div style={{ maxWidth: '80%' }}>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: '#666',
                                            marginLeft: 4,
                                            marginBottom: 2,
                                        }}
                                    >
                                        {sender}
                                        {dt ? ` · ${dt}` : ''}
                                    </div>
                                    <div
                                        style={{
                                            display: 'inline-block',
                                            padding: '7px 11px',
                                            borderRadius: 16,
                                            borderTopLeftRadius: 0,
                                            backgroundColor: '#ffffff',
                                            fontSize: 14,
                                            lineHeight: 1.4,
                                            boxShadow:
                                                '0 1px 1px rgba(0,0,0,0.06)',
                                        }}
                                    >
                                        {m.content ?? ''}
                                    </div>
                                </div>
                            )}

                            {isMine && (
                                <div
                                    style={{
                                        maxWidth: '80%',
                                        textAlign: 'right',
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'inline-block',
                                            padding: '7px 11px',
                                            borderRadius: 16,
                                            borderTopRightRadius: 0,
                                            backgroundColor: '#ffe94a',
                                            fontSize: 14,
                                            lineHeight: 1.4,
                                            boxShadow:
                                                '0 1px 1px rgba(0,0,0,0.06)',
                                        }}
                                    >
                                        {m.content ?? ''}
                                    </div>
                                    {dt && (
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: '#999',
                                                marginTop: 2,
                                                marginRight: 4,
                                            }}
                                        >
                                            {dt}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 하단 입력창 */}
            <form
                onSubmit={handleSend}
                style={{
                    padding: '8px 10px',
                    backgroundColor: '#f7f7f7',
                    borderTop: '1px solid #ddd',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <input
                        type="text"
                        placeholder="질문을 입력하세요…"
                        value={text}
                        onChange={handleChange}
                        disabled={safeRoomId === null}
                        style={{
                            flex: 1,
                            borderRadius: 18,
                            border: '1px solid #ccc',
                            padding: '6px 12px',
                            fontSize: 14,
                            outline: 'none',
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!text.trim() || safeRoomId === null}
                        style={{
                            border: 'none',
                            borderRadius: 18,
                            padding: '6px 14px',
                            fontSize: 13,
                            fontWeight: 600,
                            backgroundColor: text.trim()
                                ? '#222'
                                : '#aaa',
                            color: '#fff',
                            cursor: text.trim() ? 'pointer' : 'default',
                        }}
                    >
                        보내기
                    </button>
                </div>
            </form>
        </div>
    );
}
