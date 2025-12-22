// filepath: src/app/chatMessage/page.tsx
'use client';

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    useLayoutEffect,
    type FormEvent,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

import type { ChatMessageEntry } from '@/shared/chatMessage';
import { adaptInChatMessage } from '@/shared/chatMessage';
import { useOwnerIdValue } from '@/shared/core/owner';
import { postJson } from '@/shared/core/apiClient';
import { joinChatRoomUser } from '@/shared/chatRoom/api/queries';

const API_BASE_RAW = process.env.NEXT_PUBLIC_API_BASE ?? '';
const API_BASE = API_BASE_RAW.replace(/\/+$/, '');
const WS_ENDPOINT =
    (API_BASE && `${API_BASE}/ws-stomp`) || 'http://localhost:8080/ws-stomp';

/**
 * ✅ 일반 채팅 STOMP 경로 (서버와 다르면 여기만 수정)
 */
const TOPIC_PREFIX = '/topic/chat/';
const SEND_PREFIX = '/app/chat/';

const API_SELECT_MESSAGE_LIST = '/api/cht/chatMessage/selectChatMessageList';

const PAGE_MAX_WIDTH = 480;

/**
 * ✅ 전역 레이아웃(상단 헤더/하단 탭바) 오프셋
 */
const APP_TOP = 'var(--connect-app-header-h, var(--h, 56px))';
const APP_BOTTOM =
    'calc(var(--connect-app-bottom-nav-h, var(--connect-app-tab-h, var(--tab, 64px))) + env(safe-area-inset-bottom, 0px))';

// ---------- utils ----------
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
        if (isRec(cur)) {
            const next =
                (cur['result'] as unknown) ||
                (cur['data'] as unknown) ||
                (cur['item'] as unknown);

            if (next !== undefined && next !== null) {
                cur = next;
                continue;
            }
        }
        break;
    }
    return [];
}

async function fetchMessageHistory(roomId: number): Promise<ChatMessageEntry[]> {
    const payload: Record<string, unknown> = { roomId, limit: 50 };
    const data = await postJson<unknown>(API_SELECT_MESSAGE_LIST, payload);
    return extractMessageList(data);
}

function sortHistoryAsc(list: ChatMessageEntry[]): ChatMessageEntry[] {
    const copy = list.slice();
    copy.sort((a, b) => {
        const aIdRaw = a.id;
        const bIdRaw = b.id;

        const aId =
            typeof aIdRaw === 'number'
                ? aIdRaw
                : typeof aIdRaw === 'string'
                  ? Number(aIdRaw)
                  : Number.NaN;

        const bId =
            typeof bIdRaw === 'number'
                ? bIdRaw
                : typeof bIdRaw === 'string'
                  ? Number(bIdRaw)
                  : Number.NaN;

        if (Number.isFinite(aId) && Number.isFinite(bId)) return aId - bId;

        const aDt = String(a.sentDt ?? a.createdDt ?? '');
        const bDt = String(b.sentDt ?? b.createdDt ?? '');
        return aDt.localeCompare(bDt);
    });
    return copy;
}

function getEmailFromConnectSession(): string | null {
    if (typeof document === 'undefined') return null;
    const cookieStr = document.cookie;
    if (!cookieStr) return null;

    const cookies = cookieStr.split(';');
    const prefix = 'connect_session=';

    for (const part of cookies) {
        const trimmed = part.trim();
        if (!trimmed.startsWith(prefix)) continue;

        const rawVal = trimmed.slice(prefix.length);
        if (!rawVal) return null;

        try {
            const decoded = decodeURIComponent(rawVal);
            const parsed = JSON.parse(decoded) as unknown;

            if (isRec(parsed)) {
                const emailVal = parsed['email'];
                if (typeof emailVal === 'string' && emailVal.trim() !== '')
                    return emailVal;
            }
        } catch {
            return null;
        }
    }
    return null;
}

function createStompClient(): Client {
    return new Client({
        webSocketFactory: () => new SockJS(WS_ENDPOINT) as unknown as WebSocket,
        reconnectDelay: 5000,
    });
}

type UiMessage = {
    key: string;
    senderId: number | null;
    senderNm: string | null;
    content: string;
    sentDt: string | null;
    createdDt: string | null;
};

function cryptoRandomKey(): string {
    try {
        const buf = new Uint32Array(2);
        crypto.getRandomValues(buf);
        const a = (buf[0] ?? 0).toString(16);
        const b = (buf[1] ?? 0).toString(16);
        return `${a}${b}`;
    } catch {
        return Math.random().toString(36).slice(2);
    }
}

function toUiMessageFromEntry(m: ChatMessageEntry): UiMessage {
    const key = String(m.id ?? m.createdDt ?? m.sentDt ?? cryptoRandomKey());
    return {
        key,
        senderId: m.senderId ?? null,
        senderNm: m.senderNm ?? null,
        content: (m.content ?? '').toString(),
        sentDt: m.sentDt ?? null,
        createdDt: m.createdDt ?? null,
    };
}

type ChatMessageSendPayload = {
    roomId: number;
    content: string;
    contentType: 'TEXT';
    ownerId?: number | null;
    senderId?: number | null;
    senderNm?: string | null;
};

export default function ChatMessagePage() {
    const searchParams = useSearchParams();
    const ownerId = useOwnerIdValue();

    const rawRoomId = searchParams.get('roomId');
    const safeRoomId: number | null = rawRoomId
        ? Number(rawRoomId)
        : rawRoomId === null
          ? 1
          : null;

    const [messages, setMessages] = useState<UiMessage[]>([]);
    const [text, setText] = useState('');

    const [connecting, setConnecting] = useState(false);
    const clientRef = useRef<Client | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);

    const roomTitle = useMemo(
        () =>
            safeRoomId !== null ? `채팅 방 #${safeRoomId}` : '채팅 방',
        [safeRoomId],
    );

    useEffect(() => {
        if (safeRoomId === null) return;
        if (ownerId === null || ownerId === undefined) return;

        const senderEmail = getEmailFromConnectSession();

        void (async () => {
            try {
                await joinChatRoomUser({
                    roomId: safeRoomId,
                    userId: ownerId,
                    senderNm: senderEmail ?? null,
                    roleCd: 'MEMBER',
                });
            } catch {}
        })();

        void (async () => {
            try {
                const history = await fetchMessageHistory(safeRoomId);
                const ordered = sortHistoryAsc(history);
                setMessages(ordered.map(toUiMessageFromEntry));
            } catch {}
        })();

        const client = createStompClient();
        clientRef.current = client;
        setConnecting(true);

        client.onConnect = () => {
            setConnecting(false);

            const destination = `${TOPIC_PREFIX}${safeRoomId}`;
            client.subscribe(destination, (msg: IMessage) => {
                const bodyStr = msg.body;
                if (!bodyStr || bodyStr.trim() === '') return;

                let parsed: unknown;
                try {
                    parsed = JSON.parse(bodyStr);
                } catch {
                    return;
                }

                setMessages((p) => [...p, toUiMessageFromEntry(adaptInChatMessage(parsed))]);
            });
        };

        client.onStompError = () => setConnecting(false);
        client.onWebSocketError = () => setConnecting(false);
        client.activate();

        return () => {
            clientRef.current = null;
            client.deactivate();
        };
    }, [safeRoomId, ownerId]);

    const scrollSig = useMemo(() => {
        const last = messages[messages.length - 1];
        return last ? `${last.key}:${last.content.length}` : 'empty';
    }, [messages]);

    useLayoutEffect(() => {
        requestAnimationFrame(() => {
            if (!listRef.current) return;
            listRef.current.scrollTop = listRef.current.scrollHeight;
        });
    }, [scrollSig]);

    const handleSend = (e: FormEvent) => {
        e.preventDefault();

        const trimmed = text.trim();
        if (!trimmed || safeRoomId === null) return;

        const client = clientRef.current;
        if (!client || !client.connected) return;

        const senderEmail = getEmailFromConnectSession();

        const payload: ChatMessageSendPayload = {
            roomId: safeRoomId,
            content: trimmed,
            contentType: 'TEXT',
            ownerId: ownerId ?? null,
            senderId: ownerId ?? null,
            senderNm: senderEmail ?? null,
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
                position: 'fixed',
                top: APP_TOP,
                bottom: APP_BOTTOM, // ✅ 탭바 높이만큼 위로 올림(내용 하단 안 짤림)
                left: 0,
                right: 0,

                margin: '0 auto',
                maxWidth: PAGE_MAX_WIDTH,
                backgroundColor: '#e5e5e5',
                zIndex: 50,

                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            {/* 상단 헤더 */}
            <div
                style={{
                    flexShrink: 0,
                    padding: '8px 16px',
                    backgroundColor: '#f7f7f7',
                    borderBottom: '1px solid #ddd',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{roomTitle}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                        {safeRoomId === null
                            ? 'roomId 오류'
                            : connecting
                              ? '연결 중…'
                              : '연결 완료'}
                    </div>
                </div>
                <div style={{ fontSize: 20 }}>💬</div>
            </div>

            {/* 메시지 리스트 */}
            <div
                ref={listRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px 10px',
                    paddingBottom: 18,
                    backgroundColor: '#e5e5e5',
                    WebkitOverflowScrolling: 'touch',
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
                        대화를 시작해보세요.
                    </div>
                )}

                {messages.map((m) => {
                    const isMine = ownerId !== null && m.senderId === ownerId;
                    const sender = m.senderNm || `USER${m.senderId ?? ''}`;

                    return (
                        <div
                            key={m.key}
                            style={{
                                display: 'flex',
                                justifyContent: isMine ? 'flex-end' : 'flex-start',
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
                                            boxShadow: '0 1px 1px rgba(0,0,0,0.06)',
                                            whiteSpace: 'pre-wrap',
                                        }}
                                    >
                                        {m.content}
                                    </div>
                                </div>
                            )}

                            {isMine && (
                                <div style={{ maxWidth: '80%', textAlign: 'right' }}>
                                    <div
                                        style={{
                                            display: 'inline-block',
                                            padding: '7px 11px',
                                            borderRadius: 16,
                                            borderTopRightRadius: 0,
                                            backgroundColor: '#ffe94a',
                                            fontSize: 14,
                                            lineHeight: 1.4,
                                            boxShadow: '0 1px 1px rgba(0,0,0,0.06)',
                                            whiteSpace: 'pre-wrap',
                                        }}
                                    >
                                        {m.content}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ✅ 입력창: fixed 제거(가림 방지) */}
            <form
                onSubmit={handleSend}
                style={{
                    flexShrink: 0,
                    padding: '8px 10px',
                    backgroundColor: '#f7f7f7',
                    borderTop: '1px solid #ddd',
                    paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
                }}
            >
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        type="text"
                        placeholder="메시지 입력..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        style={{
                            flex: 1,
                            borderRadius: 18,
                            border: '1px solid #ccc',
                            padding: '8px 12px',
                            fontSize: 15,
                            outline: 'none',
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!text.trim()}
                        style={{
                            border: 'none',
                            borderRadius: 18,
                            padding: '0 14px',
                            backgroundColor: text.trim() ? '#222' : '#aaa',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: 14,
                        }}
                    >
                        전송
                    </button>
                </div>
            </form>
        </div>
    );
}
