// filepath: src/app/chatBotMessage/page.tsx
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

const TOPIC_PREFIX = '/topic/chat-bot/';
const SEND_PREFIX = '/app/chat-bot/';

const API_SELECT_MESSAGE_LIST = '/api/cht/chatMessage/selectChatMessageList';

const PAGE_MAX_WIDTH = 480;

// 유틸리티 함수들
const isRec = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null;

function pickStr(o: Record<string, unknown>, k: string): string | null {
    const v = o[k];
    return typeof v === 'string' ? v : null;
}

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

/**
 * ✅ 핵심: “오래된 → 최신” 순으로 정렬해서 화면이 아래로 흐르게 만든다.
 * - id(숫자)가 있으면 id 기준
 * - 없으면 sentDt/createdDt 문자열 비교로 fallback
 */
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

const BOT_VARIANTS = [
    { value: 'CHAT', label: 'CHAT (non-stream)' },
    { value: 'CHAT_STREAM', label: 'CHAT_STREAM (SSE)' },
    { value: 'CHAT_GRAPH', label: 'CHAT_GRAPH (LangGraph)' },
    { value: 'CHAT_GRAPH_STREAM', label: 'CHAT_GRAPH_STREAM (SSE)' },
] as const;

type BotVariant = (typeof BOT_VARIANTS)[number]['value'];
const DEFAULT_BOT_VARIANT: BotVariant = 'CHAT_GRAPH_STREAM';
const DEFAULT_TOP_K = 5;
const TOP_K_MIN = 1;
const TOP_K_MAX = 50;

function isBotVariant(v: string): v is BotVariant {
    return BOT_VARIANTS.some((b) => b.value === v);
}

type AiEvent = 'START' | 'TOKEN' | 'DONE' | 'ERROR';
function isAiEvent(v: string): v is AiEvent {
    return v === 'START' || v === 'TOKEN' || v === 'DONE' || v === 'ERROR';
}

type UiMessage = {
    key: string;
    senderId: number | null;
    senderNm: string | null;
    content: string;
    sentDt: string | null;
    createdDt: string | null;
    updatedDt: string | null;
    aiMsgId: string | null;
    botVariant: BotVariant | null;
    aiEvent: AiEvent | null;
    errorMsg: string | null;
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
        updatedDt: m.updatedDt ?? null,
        aiMsgId: null,
        botVariant: null,
        aiEvent: null,
        errorMsg: null,
    };
}

type AiPatch = {
    botVariant?: BotVariant | null;
    aiEvent?: AiEvent | null;
    errorMsg?: string | null;
    appendText?: string;
    setText?: string;
    dt?: string | null;
};

function upsertAiMessage(
    prev: ReadonlyArray<UiMessage>,
    aiMsgId: string,
    patch: AiPatch,
): UiMessage[] {
    const idx = prev.findIndex((m) => m.aiMsgId === aiMsgId);
    const nowIso = new Date().toISOString();
    const dt = patch.dt ?? nowIso;
    const existing: UiMessage | undefined = idx >= 0 ? prev[idx] : undefined;

    if (!existing) {
        const created: UiMessage = {
            key: `ai:${aiMsgId}`,
            senderId: 0,
            senderNm: 'AI',
            content: (patch.setText ?? '') + (patch.appendText ?? ''),
            sentDt: dt,
            createdDt: dt,
            updatedDt: dt,
            aiMsgId,
            botVariant: patch.botVariant ?? null,
            aiEvent: patch.aiEvent ?? null,
            errorMsg: patch.errorMsg ?? null,
        };
        return [...prev, created];
    }

    const baseText =
        patch.setText !== undefined ? patch.setText : existing.content;
    const mergedText =
        patch.appendText !== undefined
            ? `${baseText}${patch.appendText}`
            : baseText;

    const merged: UiMessage = {
        key: existing.key,
        senderId: existing.senderId,
        senderNm: existing.senderNm,
        content: mergedText,
        sentDt: existing.sentDt ?? dt,
        createdDt: existing.createdDt ?? dt,
        updatedDt: dt,
        aiMsgId: existing.aiMsgId,
        botVariant:
            patch.botVariant !== undefined ? patch.botVariant : existing.botVariant,
        aiEvent: patch.aiEvent !== undefined ? patch.aiEvent : existing.aiEvent,
        errorMsg:
            patch.errorMsg !== undefined ? patch.errorMsg : existing.errorMsg,
    };

    const copy = prev.slice();
    if (idx >= 0 && idx < copy.length) {
        copy[idx] = merged;
        return copy;
    }
    return [...prev, merged];
}

type ChatBotMessageSendPayload = {
    roomId: number;
    content: string;
    contentType: 'TEXT';
    ownerId?: number | null;
    senderId?: number | null;
    senderNm?: string | null;
    botVariant?: BotVariant;
    topK?: number;
};

export default function ChatBotMessagePage() {
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
    const [botVariant, setBotVariant] =
        useState<BotVariant>(DEFAULT_BOT_VARIANT);
    const [topK, setTopK] = useState<number>(DEFAULT_TOP_K);

    const clientRef = useRef<Client | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);

    const roomTitle = useMemo(
        () =>
            safeRoomId !== null
                ? `OpenAI(FastAPI) 챗봇 방 #${safeRoomId}`
                : 'OpenAI(FastAPI) 챗봇 방',
        [safeRoomId],
    );

    // ✅ (삭제) window.scrollTo(top:0) : 채팅 UX에선 역효과

    useEffect(() => {
        try {
            const v = localStorage.getItem('connect.chatBot.botVariant');
            if (v && isBotVariant(v)) setBotVariant(v);
            const k = localStorage.getItem('connect.chatBot.topK');
            if (k) {
                const n = Number(k);
                if (Number.isFinite(n))
                    setTopK(Math.min(TOP_K_MAX, Math.max(TOP_K_MIN, n)));
            }
        } catch {}
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('connect.chatBot.botVariant', botVariant);
            localStorage.setItem('connect.chatBot.topK', String(topK));
        } catch {}
    }, [botVariant, topK]);

    // STOMP & 채팅방 로직
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

                // ✅ 핵심: 항상 “오래된 → 최신”으로 정렬해서 렌더링
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

                if (isRec(parsed)) {
                    const evRaw = parsed['aiEvent'];
                    if (typeof evRaw === 'string' && isAiEvent(evRaw)) {
                        const aiMsgId =
                            pickStr(parsed, 'aiMsgId') ??
                            `fallback-${cryptoRandomKey()}`;
                        const bvRaw = pickStr(parsed, 'botVariant');
                        const bv: BotVariant | null =
                            bvRaw && isBotVariant(bvRaw) ? bvRaw : null;
                        const dt =
                            pickStr(parsed, 'sentDt') ??
                            pickStr(parsed, 'createdDt') ??
                            pickStr(parsed, 'updatedDt') ??
                            null;
                        const delta =
                            pickStr(parsed, 'delta') ??
                            pickStr(parsed, 'token') ??
                            pickStr(parsed, 'text') ??
                            '';
                        let answer =
                            pickStr(parsed, 'answer') ??
                            pickStr(parsed, 'content') ??
                            null;
                        if (!answer && isRec(parsed['result']))
                            answer = pickStr(
                                parsed['result'] as Record<string, unknown>,
                                'answer',
                            );
                        const errorMsg =
                            pickStr(parsed, 'errorMsg') ??
                            pickStr(parsed, 'message') ??
                            null;

                        if (evRaw === 'START') {
                            setMessages((p) =>
                                upsertAiMessage(p, aiMsgId, {
                                    botVariant: bv,
                                    aiEvent: 'START',
                                    setText: '',
                                    dt,
                                }),
                            );
                        } else if (evRaw === 'TOKEN') {
                            setMessages((p) =>
                                upsertAiMessage(p, aiMsgId, {
                                    botVariant: bv,
                                    aiEvent: 'TOKEN',
                                    appendText: delta,
                                    dt,
                                }),
                            );
                        } else if (evRaw === 'DONE') {
                            setMessages((p) => {
                                const existing = p.find(
                                    (m) => m.aiMsgId === aiMsgId,
                                );
                                const finalText =
                                    (answer ?? '').trim() ||
                                    (existing ? existing.content : '');
                                return upsertAiMessage(p, aiMsgId, {
                                    botVariant: bv,
                                    aiEvent: 'DONE',
                                    setText: finalText,
                                    dt,
                                });
                            });
                        } else if (evRaw === 'ERROR') {
                            const msgText =
                                (errorMsg ?? '').trim() || '오류 발생';
                            setMessages((p) =>
                                upsertAiMessage(p, aiMsgId, {
                                    botVariant: bv,
                                    aiEvent: 'ERROR',
                                    errorMsg: msgText,
                                    setText: msgText,
                                    dt,
                                }),
                            );
                        }
                        return;
                    }
                }

                setMessages((p) => [
                    ...p,
                    toUiMessageFromEntry(adaptInChatMessage(parsed)),
                ]);
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

    // 스크롤 자동 이동
    const scrollSig = useMemo(() => {
        const last = messages[messages.length - 1];
        return last ? `${last.key}:${last.content.length}:${last.aiEvent ?? ''}` : 'empty';
    }, [messages]);

    useLayoutEffect(() => {
        requestAnimationFrame(() => {
            if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
    }, [scrollSig]);

    const handleSend = (e: FormEvent) => {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed || safeRoomId === null) return;
        const client = clientRef.current;
        if (!client || !client.connected) return;

        const senderEmail = getEmailFromConnectSession();
        const payload: ChatBotMessageSendPayload = {
            roomId: safeRoomId,
            content: trimmed,
            contentType: 'TEXT',
            ownerId: ownerId ?? null,
            senderId: ownerId ?? null,
            senderNm: senderEmail ?? null,
            botVariant,
            topK,
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
                top: 'var(--connect-app-header-h, 0px)',
                bottom: 0,
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
            {/* 상단 헤더 (높이 고정) */}
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
                        {safeRoomId === null ? 'roomId 오류' : connecting ? '연결 중…' : '연결 완료'}
                    </div>
                </div>
                <div style={{ fontSize: 20 }}>🤖</div>
            </div>

            {/* 옵션 바 (높이 고정) */}
            <div
                style={{
                    flexShrink: 0,
                    padding: '10px 12px',
                    backgroundColor: '#f7f7f7',
                    borderBottom: '1px solid #ddd',
                }}
            >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <select
                        value={botVariant}
                        onChange={(e) =>
                            isBotVariant(e.target.value) && setBotVariant(e.target.value)
                        }
                        style={{
                            flex: 1,
                            borderRadius: 10,
                            border: '1px solid #ccc',
                            padding: '8px',
                            fontSize: 13,
                        }}
                    >
                        {BOT_VARIANTS.map((b) => (
                            <option key={b.value} value={b.value}>
                                {b.label}
                            </option>
                        ))}
                    </select>
                    <input
                        type="number"
                        min={TOP_K_MIN}
                        max={TOP_K_MAX}
                        value={topK}
                        onChange={(e) => setTopK(Number(e.target.value))}
                        style={{
                            width: 60,
                            borderRadius: 10,
                            border: '1px solid #ccc',
                            padding: '8px',
                            fontSize: 13,
                        }}
                    />
                </div>
            </div>

            {/* 메시지 리스트 */}
            <div
                ref={listRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px 10px',
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
                                        {m.aiEvent && m.aiEvent !== 'DONE' && ` · ${m.aiEvent}`}
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

            {/* 하단 입력창 */}
            <form
                onSubmit={handleSend}
                style={{
                    flexShrink: 0,
                    padding: '8px 10px',
                    backgroundColor: '#f7f7f7',
                    borderTop: '1px solid #ddd',
                    paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
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
