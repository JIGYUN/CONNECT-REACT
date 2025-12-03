// filepath: src/app/chatBotRoom/page.tsx
'use client';

import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
    useChatRoomList,
    useCreateChatRoom,
    useDeleteChatRoom,
    type ChatRoomEntry,
} from '@/shared/chatRoom';

const PAGE_MAX_WIDTH = 480;

export default function ChatBotRoomPage() {
    const router = useRouter();
    const [roomNm, setRoomNm] = useState('');

    const { data: rooms, isLoading, refetch } = useChatRoomList();
    const createRoom = useCreateChatRoom();
    const deleteRoom = useDeleteChatRoom();

    const list: ChatRoomEntry[] = rooms ?? [];

    const onChangeRoomNm = (e: ChangeEvent<HTMLInputElement>) => {
        setRoomNm(e.target.value);
    };

    const submitCreate = async () => {
        const nm = roomNm.trim();
        if (!nm || createRoom.isPending) return;
        await createRoom.mutateAsync({ roomNm: nm });
        setRoomNm('');
        void refetch();
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            void submitCreate();
        }
    };

    const goRoom = (roomId: number | null | undefined) => {
        if (!roomId) return;
        const href = `/chatBotMessage?roomId=${encodeURIComponent(
            String(roomId),
        )}` as Route;
        router.push(href);
    };

    const onDelete = async (roomId: number | null | undefined) => {
        if (!roomId) return;
        const ok = window.confirm('해당 챗봇 채팅방을 삭제하시겠습니까?');
        if (!ok) return;
        await deleteRoom.mutateAsync({ roomId });
        void refetch();
    };

    const isEmpty = !isLoading && list.length === 0;

    return (
        <div
            style={{
                maxWidth: PAGE_MAX_WIDTH,
                margin: '0 auto',
                padding: '16px 12px',
            }}
        >
            {/* 헤더 */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                }}
            >
                <h2 style={{ margin: 0, fontSize: 20 }}>Qwen 챗봇 채팅방</h2>
                <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => refetch()}
                >
                    새로고침
                </button>
            </div>

            {/* 방 생성 */}
            <div style={{ marginBottom: 12 }}>
                <div className="input-group">
                    <input
                        type="search"
                        id="roomNmInput"
                        className="form-control"
                        placeholder="챗봇 방 이름 입력 후 Enter"
                        aria-label="챗봇 방 이름 입력"
                        value={roomNm}
                        onChange={onChangeRoomNm}
                        onKeyDown={onKeyDown}
                    />
                    <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => void submitCreate()}
                        disabled={createRoom.isPending}
                    >
                        {createRoom.isPending ? '생성 중…' : '추가'}
                    </button>
                </div>
            </div>

            {/* 리스트 */}
            {isLoading && (
                <div className="text-center py-4 text-muted">불러오는 중…</div>
            )}

            {isEmpty && (
                <div className="text-center py-4 text-muted">
                    등록된 챗봇 방이 없습니다.
                </div>
            )}

            {!isLoading &&
                !isEmpty &&
                list.map((r, idx) => {
                    let numericId: number | null = null;
                    if (typeof r.id === 'number' && Number.isFinite(r.id)) {
                        numericId = r.id;
                    } else if (
                        typeof r.ownerId === 'number' &&
                        Number.isFinite(r.ownerId)
                    ) {
                        numericId = r.ownerId;
                    }

                    const lastMsg = r.lastMsgContent ?? '';
                    const lastDt =
                        r.lastMsgSentDt ??
                        r.updatedDt ??
                        r.createdDt ??
                        '';

                    const preview =
                        lastMsg.length > 40
                            ? `${lastMsg.slice(0, 39)}…`
                            : lastMsg;

                    return (
                        <div
                            key={
                                numericId !== null
                                    ? `bot-room-${numericId}`
                                    : `bot-room-card-${idx}`
                            }
                            className="mb-2 p-2 border rounded"
                            style={{
                                cursor: numericId ? 'pointer' : 'default',
                                backgroundColor: '#ffffff',
                            }}
                            onClick={() => goRoom(numericId)}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 4,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 600,
                                    }}
                                >
                                    {r.roomNm ?? ''}
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void onDelete(numericId);
                                    }}
                                >
                                    삭제
                                </button>
                            </div>
                            <div
                                style={{
                                    fontSize: 12,
                                    color: '#555',
                                    marginBottom: 2,
                                }}
                            >
                                {preview || '마지막 메시지 없음'}
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: '#888',
                                }}
                            >
                                {lastDt || ''}
                            </div>
                        </div>
                    );
                })}
        </div>
    );
}
