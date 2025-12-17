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

/**
 * ✅ 서버(STOMP) 브릿지에서 사용하는 prefix에 맞춰야 함
 *  - topic: /topic/chat-bot/{roomId}
 *  - send : /app/chat-bot/{roomId}
 */
const TOPIC_PREFIX = '/topic/chat-bot/';
const SEND_PREFIX = '/app/chat-bot/';

const API_SELECT_MESSAGE_LIST = '/api/cht/chatMessage/selectChatMessageList';

const PAGE_MAX_WIDTH = 480;

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

// connect_session 쿠키에서 email 추출
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
    return new Client({
        webSocketFactory: () => new SockJS(WS_ENDPOINT) as unknown as WebSocket,
        reconnectDelay: 5000,
    });
}

/** =========================
 *  OpenAI(FastAPI) Bot Variant
 *  ========================= */
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

    // AI stream meta
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

    // ✅ findIndex 결과가 >= 0이어도 noUncheckedIndexedAccess 때문에 prev[idx]가 undefined일 수 있다고 경고함
    const existing: UiMessage | undefined =
        idx >= 0 ? prev[idx] : undefined;

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
        patch.appendText !== undefined ? `${baseText}${patch.appendText}` : baseText;

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
        aiEvent:
            patch.aiEvent !== undefined ? patch.aiEvent : existing.aiEvent,
        errorMsg:
            patch.errorMsg !== undefined ? patch.errorMsg : existing.errorMsg,
    };

    const copy = prev.slice();
    // idx는 기존 메시지가 존재하면 반드시 유효하나, 타입 안정 위해 existing 기준으로 교체
    if (idx >= 0 && idx < copy.length) {
        copy[idx] = merged;
        return copy;
    }

    // 혹시나 idx가 이상해진 케이스는 안전하게 append
    return [...prev, merged];
}

type ChatBotMessageSendPayload = {
    roomId: number;
    content: string;
    contentType: 'TEXT';
    ownerId?: number | null;
    senderId?: number | null;
    senderNm?: string | null;

    // ✅ OpenAI(FastAPI)
    botVariant?: BotVariant;
    topK?: number;
};

export default function ChatBotMessagePage() {
    const searchParams = useSearchParams();
    const ownerId = useOwnerIdValue();

    const rawRoomId = searchParams.get('roomId');
    const parsedRoomId = rawRoomId ? Number(rawRoomId) : Number.NaN;

    // roomId 파라미터 없으면 기본값 1
    const safeRoomId: number | null = Number.isFinite(parsedRoomId)
        ? parsedRoomId
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

    // localStorage 복원
    useEffect(() => {
        try {
            const v = localStorage.getItem('connect.chatBot.botVariant');
            if (v && isBotVariant(v)) setBotVariant(v);

            const k = localStorage.getItem('connect.chatBot.topK');
            if (k) {
                const n = Number(k);
                if (Number.isFinite(n)) {
                    const clamped = Math.min(TOP_K_MAX, Math.max(TOP_K_MIN, n));
                    setTopK(clamped);
                }
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('connect.chatBot.botVariant', botVariant);
        } catch {
            // ignore
        }
    }, [botVariant]);

    useEffect(() => {
        try {
            localStorage.setItem('connect.chatBot.topK', String(topK));
        } catch {
            // ignore
        }
    }, [topK]);

    // 방 입장 + 히스토리 + STOMP 연결
    useEffect(() => {
        if (safeRoomId === null) return;
        if (ownerId === null || ownerId === undefined) return;

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
                // ignore
            }
        })();

        // 기존 히스토리
        void (async () => {
            try {
                const history = await fetchMessageHistory(safeRoomId);
                setMessages(history.map(toUiMessageFromEntry));
            } catch {
                // ignore
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
                if (typeof bodyStr !== 'string' || bodyStr.trim() === '') return;

                let parsed: unknown;
                try {
                    parsed = JSON.parse(bodyStr) as unknown;
                } catch {
                    return;
                }

                // ✅ aiEvent 처리
                if (isRec(parsed)) {
                    const evRaw = parsed['aiEvent'];
                    if (typeof evRaw === 'string' && isAiEvent(evRaw)) {
                        const aiMsgId =
                            pickStr(parsed, 'aiMsgId') ?? `fallback-${cryptoRandomKey()}`;

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

                        // result.answer 지원
                        const resultNode = parsed['result'];
                        if (!answer && isRec(resultNode)) {
                            answer = pickStr(resultNode, 'answer');
                        }

                        const errorMsg =
                            pickStr(parsed, 'errorMsg') ??
                            pickStr(parsed, 'message') ??
                            null;

                        if (evRaw === 'START') {
                            setMessages((prev) =>
                                upsertAiMessage(prev, aiMsgId, {
                                    botVariant: bv,
                                    aiEvent: 'START',
                                    setText: '',
                                    dt,
                                }),
                            );
                            return;
                        }

                        if (evRaw === 'TOKEN') {
                            setMessages((prev) =>
                                upsertAiMessage(prev, aiMsgId, {
                                    botVariant: bv,
                                    aiEvent: 'TOKEN',
                                    appendText: delta,
                                    dt,
                                }),
                            );
                            return;
                        }

                        if (evRaw === 'DONE') {
                            const answerTrim = (answer ?? '').trim();

                            setMessages((prev) => {
                                const existing = prev.find((m) => m.aiMsgId === aiMsgId);
                                const fallback = existing ? existing.content : '';
                                const finalText = answerTrim !== '' ? answerTrim : fallback;

                                return upsertAiMessage(prev, aiMsgId, {
                                    botVariant: bv,
                                    aiEvent: 'DONE',
                                    setText: finalText,
                                    dt,
                                });
                            });
                            return;
                        }

                        if (evRaw === 'ERROR') {
                            const msgText =
                                (errorMsg ?? '').trim() || 'AI 처리 중 오류가 발생했습니다.';

                            setMessages((prev) =>
                                upsertAiMessage(prev, aiMsgId, {
                                    botVariant: bv,
                                    aiEvent: 'ERROR',
                                    errorMsg: msgText,
                                    setText: msgText,
                                    dt,
                                }),
                            );
                            return;
                        }
                    }
                }

                // 일반 메시지(저장 row)
                const entry = adaptInChatMessage(parsed);
                const ui = toUiMessageFromEntry(entry);
                setMessages((prev) => [...prev, ui]);
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

    // 스크롤: 마지막 메시지 길이 변화(토큰 추가)에도 반응
    const scrollSig = useMemo(() => {
        const last =
            messages.length > 0 ? messages[messages.length - 1] : null;
        return last ? `${last.key}:${last.content.length}:${last.aiEvent ?? ''}` : 'empty';
    }, [messages]);

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [scrollSig]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setText(e.target.value);
    };

    const handleBotVariantChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const v = e.target.value;
        if (isBotVariant(v)) setBotVariant(v);
    };

    const handleTopKChange = (e: ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        const clamped = Math.min(TOP_K_MAX, Math.max(TOP_K_MIN, n));
        setTopK(clamped);
    };

    const handleSend = (e: FormEvent) => {
        e.preventDefault();

        const trimmed = text.trim();
        if (!trimmed || safeRoomId === null) return;

        const client = clientRef.current;
        if (!client || !client.connected) return;

        const senderEmail = getEmailFromConnectSession();
        const senderNm: string | null = senderEmail ?? null;

        const payload: ChatBotMessageSendPayload = {
            roomId: safeRoomId,
            content: trimmed,
            contentType: 'TEXT',
            ownerId: ownerId ?? null,
            senderId: ownerId ?? null,
            senderNm,

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
                maxWidth: PAGE_MAX_WIDTH,
                margin: '0 auto',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#e5e5e5',
                border: '1px solid #ddd',
            }}
        >
            {/* 헤더 */}
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
                    <div style={{ fontSize: 16, fontWeight: 700 }}>
                        {roomTitle}
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                        {safeRoomId === null
                            ? 'roomId 오류'
                            : connecting
                            ? '연결 중…'
                            : '연결 완료'}{' '}
                        · 엔진: OPENAI-FASTAPI
                    </div>
                </div>
                <div style={{ fontSize: 20 }}>🤖</div>
            </div>

            {/* 옵션 바 */}
            <div
                style={{
                    padding: '10px 12px',
                    backgroundColor: '#f7f7f7',
                    borderBottom: '1px solid #ddd',
                }}
            >
                <div style={{ fontSize: 12, color: '#444', marginBottom: 6 }}>
                    봇 버전 선택 (FastAPI)
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <select
                        value={botVariant}
                        onChange={handleBotVariantChange}
                        style={{
                            flex: 1,
                            borderRadius: 10,
                            border: '1px solid #ccc',
                            padding: '8px 10px',
                            fontSize: 13,
                            backgroundColor: '#fff',
                        }}
                    >
                        {BOT_VARIANTS.map((b) => (
                            <option key={b.value} value={b.value}>
                                {b.label}
                            </option>
                        ))}
                    </select>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 12, color: '#444' }}>topK</div>
                        <input
                            type="number"
                            min={TOP_K_MIN}
                            max={TOP_K_MAX}
                            value={topK}
                            onChange={handleTopKChange}
                            style={{
                                width: 76,
                                borderRadius: 10,
                                border: '1px solid #ccc',
                                padding: '8px 10px',
                                fontSize: 13,
                                backgroundColor: '#fff',
                            }}
                        />
                    </div>
                </div>

                <div style={{ marginTop: 6, fontSize: 11, color: '#777' }}>
                    메시지 전송 시 선택값이 <b>payload.botVariant</b>, <b>payload.topK</b>로 서버에 전달됩니다.
                </div>
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
                    const isMine =
                        ownerId !== null &&
                        ownerId !== undefined &&
                        m.senderId === ownerId;

                    const sender =
                        m.senderNm && m.senderNm.trim() !== ''
                            ? m.senderNm
                            : `USER${m.senderId ?? ''}`;

                    const dt = m.sentDt ?? m.updatedDt ?? m.createdDt ?? '';

                    const metaParts: string[] = [];
                    if (m.botVariant) metaParts.push(m.botVariant);
                    if (m.aiEvent && m.aiEvent !== 'DONE') metaParts.push(m.aiEvent);
                    if (m.aiEvent === 'ERROR') metaParts.push('ERROR');

                    const meta = metaParts.length > 0 ? ` · ${metaParts.join(' · ')}` : '';

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
                                        {dt ? ` · ${dt}` : ''}
                                        {meta}
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
                                        {m.aiEvent === 'TOKEN' && (
                                            <span style={{ opacity: 0.5 }}> ▍</span>
                                        )}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                        type="text"
                        placeholder="질문을 입력 후 Enter"
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
                        }}
                    >
                        보내기
                    </button>
                </div>
            </form>
        </div>
    );
}
