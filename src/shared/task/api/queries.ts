// filepath: src/shared/task/api/queries.ts
import {
    useQuery,
    useMutation,
    useQueryClient,
    type QueryKey,
} from '@tanstack/react-query';
import { getJson, postJson } from '@/shared/core/apiClient';
import { adaptInTask } from '../adapters';
import type { AnyRecord } from '@/shared/types/common';
import type { Task, TaskCreate, TaskDelete, TaskToggle } from '../types';

/* ───────────────────────── 공통 유틸 ───────────────────────── */

function arrFrom(v: unknown): AnyRecord[] {
    if (Array.isArray(v)) return v as AnyRecord[];
    if (!v || typeof v !== 'object') return [];
    const o = v as Record<string, unknown>;
    return (
        (Array.isArray(o['result']) && (o['result'] as AnyRecord[])) ||
        (Array.isArray(o['rows']) && (o['rows'] as AnyRecord[])) ||
        (Array.isArray(o['list']) && (o['list'] as AnyRecord[])) ||
        []
    );
}

function keyByDate(dueDate: string, grpCd: string | null, ownerId: number | null): QueryKey {
    return ['task/byDate', dueDate, grpCd ?? null, ownerId ?? null];
}

/* ───────────────────────── 호출 최적화(폴백 1회→캐시) ───────────────────────── */

const FORCE_BASE = (process.env['NEXT_PUBLIC_TASK_API_BASE'] ?? '').trim();
const FORCE_METHOD = (process.env['NEXT_PUBLIC_TASK_API_METHOD'] ?? '')
    .trim()
    .toUpperCase() as '' | 'GET' | 'POST';

type HttpMethod = 'GET' | 'POST';
type Attempt<T> = { run: () => Promise<T>; url: string; method: HttpMethod };

const okMemo = new Map<string, number>();
const LS_KEY_PREFIX = 'task.api.pick.';

function join(base: string, path: string) {
    return base.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
}

function GET<T>(url: string, params: Record<string, unknown>): Attempt<T> {
    return { url, method: 'GET', run: () => getJson<T>(url, { params }) };
}
function POST<T>(url: string, body: unknown): Attempt<T> {
    return { url, method: 'POST', run: () => postJson<T>(url, body) };
}

function loadPick(label: string): number | null {
    try {
        if (typeof window === 'undefined') return null;
        const v = window.localStorage.getItem(LS_KEY_PREFIX + label);
        return v ? Number(v) : null;
    } catch { return null; }
}
function savePick(label: string, idx: number) {
    try {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(LS_KEY_PREFIX + label, String(idx));
    } catch {}
}

async function firstOkCached<T>(label: string, attempts: Array<Attempt<T>>): Promise<T> {
    if (attempts.length === 0) throw new Error('No attempts');

    if (FORCE_BASE) {
        for (const a of attempts) {
            if (!a.url.startsWith(FORCE_BASE)) continue;
            if (FORCE_METHOD && a.method !== FORCE_METHOD) continue;
            return await a.run();
        }
        return await attempts[0]!.run();
    }

    const mem = okMemo.get(label);
    if (mem != null) {
        const a = attempts[mem];
        if (a) {
            try { return await a.run(); } catch { /* fallback */ }
        }
    }

    const ls = loadPick(label);
    if (ls != null) {
        const a = attempts[ls];
        if (a) {
            try {
                const res = await a.run();
                okMemo.set(label, ls);
                return res;
            } catch { /* fallback */ }
        }
    }

    let lastErr: unknown;
    for (let i = 0; i < attempts.length; i++) {
        const a = attempts[i];
        if (!a) continue;
        try {
            const res = await a.run();
            okMemo.set(label, i);
            savePick(label, i);
            return res;
        } catch (e) { lastErr = e; }
    }
    throw (lastErr instanceof Error ? lastErr : new Error('Request failed'));
}

/* ───────────────────────── 목록 ───────────────────────── */

export function useTaskListByDate(p: { dueDate: string; grpCd?: string | null; ownerId?: number }) {
    const dueDate = p.dueDate;
    const grpCd = p.grpCd ?? null;
    const ownerId = p.ownerId ?? null;

    return useQuery<Task[]>({
        queryKey: keyByDate(dueDate, grpCd, ownerId),
        queryFn: async (): Promise<Task[]> => {
            const params: Record<string, unknown> = { dueDate, date: dueDate, ymd: dueDate };
            if (grpCd) params['grpCd'] = grpCd;
            if (ownerId != null) params['ownerId'] = ownerId;

            const raw = await firstOkCached<unknown>('task.selectTaskListByDate', [
                GET<unknown>(join('/api/task', 'selectTaskListByDate'), params),
                GET<unknown>(join('/api/tsk/task', 'selectTaskListByDate'), params),
                POST<unknown>(join('/api/task', 'selectTaskListByDate'), params),
                POST<unknown>(join('/api/tsk/task', 'selectTaskListByDate'), params),
            ]);

            return arrFrom(raw).map(adaptInTask);
        },
        staleTime: 2_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 0,
    });
}

/* ───────────────────────── 등록 ───────────────────────── */

type InsertBody = {
    title: string;
    dueDt?: string | null;
    grpCd?: string | null;
    ownerId?: number;
};

export function useInsertTask(ctx: { grpCd?: string | null; ownerId?: number }) {
    const qc = useQueryClient();
    const grpCdFromCtx = ctx.grpCd ?? null;
    const ownerIdFromCtx = ctx.ownerId ?? null;

    return useMutation<void, Error, TaskCreate>({
        async mutationFn({ title, dueDt, grpCd, ownerId }: TaskCreate): Promise<void> {
            if (typeof title !== 'string' || title.trim() === '') throw new Error('title required');

            const body: InsertBody = { title };

            if (typeof dueDt === 'string' && dueDt) body.dueDt = dueDt;
            else body.dueDt = null;

            if (typeof grpCd === 'string') body.grpCd = grpCd;
            else if (grpCdFromCtx !== null) body.grpCd = grpCdFromCtx;

            if (typeof ownerId === 'number') body.ownerId = ownerId;
            else if (ownerIdFromCtx !== null) body.ownerId = ownerIdFromCtx;

            await firstOkCached<void>('task.insertTask', [
                POST<void>(join('/api/tsk/task', 'insertTask'), body),
            ]);
        },
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['task/byDate'] }); },
    });
}

/* ───────────────────────── 상태 토글 ───────────────────────── */

type ToggleBody = {
    taskId: number;
    statusCd: string;
    ownerId?: number;
};

export function useToggleTask(ctx: { ownerId?: number }) {
    const qc = useQueryClient();
    const ownerIdFromCtx = ctx.ownerId ?? null;

    return useMutation<void, Error, TaskToggle>({
        async mutationFn({ taskId, statusCd }: TaskToggle): Promise<void> {
            const id =
                typeof taskId === 'number' ? taskId
                    : (() => { throw new Error('taskId required(number)'); })();

            if (typeof statusCd !== 'string' || !statusCd) throw new Error('statusCd required');

            const body: ToggleBody = { taskId: id, statusCd };
            if (ownerIdFromCtx !== null) body.ownerId = ownerIdFromCtx;

            await firstOkCached<void>('task.toggleTask', [
                POST<void>(join('/api/tsk/task', 'toggleTask'), body),
                POST<void>(join('/api/tsk/task', 'updateTaskStatus'), body),
            ]);
        },
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['task/byDate'] }); },
    });
}

/* ───────────────────────── 삭제 ───────────────────────── */

type DeleteBody = {
    taskId: number;
    ownerId?: number;
};

export function useDeleteTask(ctx: { ownerId?: number }) {
    const qc = useQueryClient();
    const ownerIdFromCtx = ctx.ownerId ?? null;

    return useMutation<void, Error, TaskDelete>({
        async mutationFn({ taskId }: TaskDelete): Promise<void> {
            const id =
                typeof taskId === 'number' ? taskId
                    : (() => { throw new Error('taskId required(number)'); })();

            const body: DeleteBody = { taskId: id };
            if (ownerIdFromCtx !== null) body.ownerId = ownerIdFromCtx;

            await firstOkCached<void>('task.deleteTask', [
                POST<void>(join('/api/tsk/task', 'deleteTask'), body),
            ]);
        },
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['task/byDate'] }); },
    });
}
