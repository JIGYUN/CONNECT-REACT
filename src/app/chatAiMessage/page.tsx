// filepath: src/app/chatAiMessage/page.tsx
'use client';

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    useLayoutEffect,
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

const TOPIC_PREFIX = '/topic/chat-ai/';
const SEND_PREFIX = '/app/chat-ai/';

const API_SELECT_MESSAGE_LIST = '/api/cht/chatMessage/selectChatMessageList';

const PAGE_MAX_WIDTH = 480;

// ✅ 전역 레이아웃(상단 헤더/하단 탭바) 오프셋
// - CSS 변수 없으면 56/64px fallback
const APP_TOP = 'var(--connect-app-header-h, var(--h, 56px))';
const APP_BOTTOM = 'var(--connect-app-bottom-nav-h, 64px)';

// Qwen 고정, 대상 언어 선택용 타입
type TargetLang = 'ko' | 'en' | 'ja' | 'zh-CN';

const DEFAULT_TARGET_LANG: TargetLang = 'ko';

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

async function fetchMessageHistory(roomId: number): Promise<ChatMessageEntry[]> {
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
        webSocketFactory: () => new SockJS(WS_ENDPOINT) as unknown as WebSocket,
        reconnectDelay: 5000,
    });
    return client;
}

type ChatAiMessageSendPayload = {
    roomId: number;
    content: string;
    contentType: 'TEXT';
    targetLang: TargetLang;
    engine: 'QWEN'; // 엔진은 QWEN 고정
    ownerId?: number | null;
    senderId?: number | null;
    senderNm?: string | null;
};

export default function ChatAiMessagePage() {
    const searchParams = useSearchParams();
    const ownerId = useOwnerIdValue();

    const rawRoomId = searchParams.get('roomId');
    const parsedRoomId = rawRoomId ? Number(rawRoomId) : Number.NaN;
    const safeRoomId: number | null = Number.isFinite(parsedRoomId)
        ? parsedRoomId
        : null;

    const [messages, setMessages] = useState<ChatMessageEntry[]>([]);
    const [text, setText] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [targetLang, setTargetLang] =
        useState<TargetLang>(DEFAULT_TARGET_LANG);

    const clientRef = useRef<Client | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);

    const roomTitle = useMemo(
        () =>
            safeRoomId !== null
                ? `AI 자동번역 방 #${safeRoomId}`
                : 'AI 자동번역 방',
        [safeRoomId],
    );

    // ✅ 스크롤 튀는 현상 방지를 위해 초기 위치 고정
    useEffect(() => {
        if (typeof window !== 'undefined') window.scrollTo(0, 0);
    }, []);

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

        // 기존 메시지 히스토리
        void (async () => {
            try {
                const history = await fetchMessageHistory(safeRoomId);
                setMessages(history);
            } catch {
                // 무시
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

    // ✅ 메시지 추가 시 스크롤 아래로 (LayoutEffect + rAF 사용으로 안정성 확보)
    useLayoutEffect(() => {
        requestAnimationFrame(() => {
            const el = listRef.current;
            if (el) {
                el.scrollTop = el.scrollHeight;
            }
        });
    }, [messages]);

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

        const payload: ChatAiMessageSendPayload = {
            roomId: safeRoomId,
            content: trimmed,
            contentType: 'TEXT',
            targetLang,
            engine: 'QWEN',
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
                // ✅ 핵심 수정:
                // - top: 전역 헤더 높이만큼 내림
                // - bottom: 하단 메뉴 높이만큼 올림 (메시지/입력창/마지막 답변 안 잘림)
                position: 'fixed',
                top: APP_TOP,
                bottom: APP_BOTTOM,
                left: 0,
                right: 0,

                maxWidth: PAGE_MAX_WIDTH,
                margin: '0 auto',

                backgroundColor: '#e5e5e5',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 50,
            }}
        >
            {/* 헤더 + 대상 언어 선택 (높이 고정) */}
            <div
                style={{
                    flexShrink: 0,
                    padding: '8px 12px',
                    borderBottom: '1px solid #ddd',
                    backgroundColor: '#f7f7f7',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4,
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
                                  : '연결 완료'}
                        </div>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: 4,
                        }}
                    >
                        <div style={{ fontSize: 20 }}>🤖</div>
                        <label
                            style={{
                                fontSize: 11,
                                color: '#555',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            대상 언어
                            <select
                                value={targetLang}
                                onChange={(ev: ChangeEvent<HTMLSelectElement>) => {
                                    const v = ev.target.value as TargetLang;
                                    if (
                                        v === 'ko' ||
                                        v === 'en' ||
                                        v === 'ja' ||
                                        v === 'zh-CN'
                                    ) {
                                        setTargetLang(v);
                                    } else {
                                        setTargetLang(DEFAULT_TARGET_LANG);
                                    }
                                }}
                                style={{
                                    fontSize: 12,
                                    padding: '2px 6px',
                                }}
                            >
                                <option value="ko">한국어 (ko)</option>
                                <option value="en">영어 (en)</option>
                                <option value="ja">일본어 (ja)</option>
                                <option value="zh-CN">중국어 간체 (zh-CN)</option>
                            </select>
                        </label>
                    </div>
                </div>
            </div>

            {/* 메시지 리스트 (남은 공간 모두 차지 + 내부 스크롤) */}
            <div
                ref={listRef}
                style={{
                    flex: 1,
                    padding: '12px 10px 8px',
                    overflowY: 'auto',
                    backgroundColor: '#e5e5e5',
                    WebkitOverflowScrolling: 'touch',

                    // ✅ 마지막 메시지가 입력폼에 너무 붙지 않게 여유
                    paddingBottom: 16,
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
                        아직 메시지가 없습니다.
                    </div>
                )}

                {messages.map((m) => {
                    const id = m.id ?? m.createdDt ?? Math.random().toString(36);
                    const isMine =
                        ownerId !== null &&
                        ownerId !== undefined &&
                        m.senderId === ownerId;

                    const sender =
                        m.senderNm && m.senderNm.trim() !== ''
                            ? m.senderNm
                            : `USER${m.senderId ?? ''}`;

                    const dt = m.sentDt ?? m.updatedDt ?? m.createdDt ?? '';

                    // translatedText
                    let translated: string | null = null;
                    {
                        const raw: unknown = (m as { translatedText?: unknown })
                            .translatedText;
                        if (typeof raw === 'string') {
                            const t = raw.trim();
                            if (t !== '') translated = t;
                        }
                    }

                    // translateErrorMsg
                    let translateError: string | null = null;
                    {
                        const raw: unknown = (m as { translateErrorMsg?: unknown })
                            .translateErrorMsg;
                        if (typeof raw === 'string') {
                            const t = raw.trim();
                            if (t !== '') translateError = t;
                        }
                    }

                    // engine
                    let engineUsed: string | null = null;
                    {
                        const raw: unknown = (m as { engine?: unknown }).engine;
                        if (typeof raw === 'string') {
                            const t = raw.trim();
                            if (t !== '') engineUsed = t;
                        }
                    }

                    // targetLang
                    let targetLangUsedDisplay: string | null = null;
                    {
                        const raw: unknown = (m as { targetLang?: unknown }).targetLang;
                        if (typeof raw === 'string') {
                            const t = raw.trim();
                            if (t !== '') targetLangUsedDisplay = t;
                        }
                    }

                    return (
                        <div
                            key={String(id)}
                            style={{
                                display: 'flex',
                                justifyContent: isMine ? 'flex-end' : 'flex-start',
                                marginBottom: 8,
                            }}
                        >
                            <div
                                style={{
                                    maxWidth: '80%',
                                    textAlign: isMine ? 'right' : 'left',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: '#666',
                                        marginLeft: isMine ? 0 : 4,
                                        marginRight: isMine ? 4 : 0,
                                        marginBottom: 2,
                                    }}
                                >
                                    {sender}
                                    {dt ? ` · ${dt}` : ''}
                                    {engineUsed ? ` · ${engineUsed}` : ''}
                                    {targetLangUsedDisplay
                                        ? ` · target: ${targetLangUsedDisplay}`
                                        : ''}
                                </div>

                                <div
                                    style={{
                                        display: 'inline-block',
                                        padding: '7px 11px',
                                        borderRadius: 16,
                                        borderTopRightRadius: isMine ? 0 : 16,
                                        borderTopLeftRadius: isMine ? 16 : 0,
                                        backgroundColor: isMine ? '#ffe94a' : '#ffffff',
                                        fontSize: 14,
                                        lineHeight: 1.4,
                                        boxShadow: '0 1px 1px rgba(0,0,0,0.06)',
                                        whiteSpace: 'pre-wrap',
                                    }}
                                >
                                    {m.content ?? ''}
                                </div>

                                {translated && (
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: '#555',
                                            marginTop: 3,
                                            marginLeft: isMine ? 0 : 4,
                                            marginRight: isMine ? 4 : 0,
                                            whiteSpace: 'pre-wrap',
                                        }}
                                    >
                                        {translated}
                                    </div>
                                )}

                                {!translated && translateError && (
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: '#d00',
                                            marginTop: 3,
                                            marginLeft: isMine ? 0 : 4,
                                            marginRight: isMine ? 4 : 0,
                                            whiteSpace: 'pre-wrap',
                                        }}
                                    >
                                        번역 실패: {translateError}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 하단 입력창 */}
            <form
                onSubmit={handleSend}
                style={{
                    flexShrink: 0,
                    padding: '8px 10px',
                    backgroundColor: '#f7f7f7',
                    borderTop: '1px solid #ddd',

                    // ✅ safe-area만 처리 (탭바 높이는 래퍼 bottom에서 이미 처리)
                    paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
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
                        placeholder="메시지를 입력하세요…"
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
                            backgroundColor: text.trim() ? '#222' : '#aaa',
                            color: '#fff',
                            cursor: text.trim() ? 'pointer' : 'default',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        보내기
                    </button>
                </div>
            </form>
        </div>
    );
}
