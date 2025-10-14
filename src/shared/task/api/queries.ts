/* filepath: src/app/features/task/api/queries.ts */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@shared/core/apiClient';
import { adaptInTask } from '../adapters';
import type { Task, TaskCreate, TaskDelete, TaskToggle } from '../types';

const DEFAULT_OWNER_ID = Number(process.env.NEXT_PUBLIC_FAKE_OWNER_ID ?? '1');

const API = {
  listByDate: '/api/tsk/task/selectTaskListByDate',
  insert:     '/api/tsk/task/insertTask',
  toggle:     '/api/tsk/task/toggleTask',
  remove:     '/api/tsk/task/deleteTask',
};

function unwrap<T = any>(res: any): T {
  return (res && typeof res === 'object' && 'data' in res) ? (res.data as T) : (res as T);
}
function normalizeOk(p: any) {
  return { ok: typeof p?.ok === 'boolean' ? p.ok : true, msg: p?.msg };
}

export function useTaskListByDate(params: { dueDate?: string; grpCd?: string | null; ownerId?: number }) {
  const dueDate = params.dueDate;
  const grpCd   = params.grpCd ?? null;
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;

  return useQuery({
    queryKey: ['taskListByDate', dueDate, grpCd, ownerId],
    enabled: !!dueDate,
    queryFn: async (): Promise<Task[]> => {
      const body: any = { dueDate, ownerId };
      if (grpCd) body.grpCd = grpCd;

      const res0 = await apiClient.post(API.listByDate, body);
      const res  = unwrap(res0);
      const { ok, msg } = normalizeOk(res);
      if (!ok) throw new Error(msg ?? 'selectTaskListByDate failed');

      const raw =
        res?.result?.list ??
        res?.result?.rows ??
        res?.result?.data ??
        (Array.isArray(res?.result) ? res.result : undefined) ??
        res?.data ??
        res;

      const arr: any[] = Array.isArray(raw) ? raw : [];
      return arr.map(adaptInTask).sort((a, b) => (toMillis(a.dueDt) - toMillis(b.dueDt)));
    },
    staleTime: 10_000,
  });
}

export function useInsertTask(params: { grpCd?: string | null; ownerId?: number }) {
  const qc = useQueryClient();
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;

  return useMutation({
    mutationFn: async (payload: TaskCreate) => {
      const body: any = {
        title: payload.title,
        dueDt: payload.dueDt,
        grpCd: (payload.grpCd ?? params.grpCd) ?? null,
        ownerId,
      };
      const res0 = await apiClient.post(API.insert, body);
      const res  = unwrap(res0);
      const { ok, msg } = normalizeOk(res);
      if (!ok) throw new Error(msg ?? 'insertTask failed');
      return res?.result ?? res;
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['taskListByDate'] });
      const d = (v as any)?.dueDate || (v as any)?.dueDt || (v as any)?.due_date;
      if (d) qc.invalidateQueries({ queryKey: ['taskListByDate', d] as any });
    },
  });
}

export function useToggleTask(params: { ownerId?: number }) {
  const qc = useQueryClient();
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;

  return useMutation({
    mutationFn: async (payload: TaskToggle) => {
      const body = { taskId: payload.taskId, statusCd: payload.statusCd, ownerId };
      const res0 = await apiClient.post(API.toggle, body);
      const res  = unwrap(res0);
      const { ok, msg } = normalizeOk(res);
      if (!ok) throw new Error(msg ?? 'toggleTask failed');
      return res?.result ?? res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taskListByDate'] }),
  });
}

export function useDeleteTask(params: { ownerId?: number }) {
  const qc = useQueryClient();
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;

  return useMutation({
    mutationFn: async (payload: TaskDelete) => {
      const body = { taskId: payload.taskId, ownerId };
      const res0 = await apiClient.post(API.remove, body);
      const res  = unwrap(res0);
      const { ok, msg } = normalizeOk(res);
      if (!ok) throw new Error(msg ?? 'deleteTask failed');
      return res?.result ?? res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taskListByDate'] }),
  });
}

// local
function toMillis(d?: string | null) {
  if (!d) return Number.MAX_SAFE_INTEGER;
  const s = String(d).replace('T', ' ');
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:\s(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const Y = +m[1], Mo = +m[2] - 1, D = +m[3], h = +(m[4] || 0), mi = +(m[5] || 0), se = +(m[6] || 0);
  return new Date(Y, Mo, D, h, mi, se).getTime();
}