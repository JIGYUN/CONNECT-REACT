// filepath: src/shared/task/adapters.ts
import type { Task } from './types';

/** ── runtime guards ─────────────────────────────────────────── */
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 내부 안전 접근 */
function pick(o: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) if (k in o) return o[k];
  return undefined;
}
function pickStr(o: Record<string, unknown>, ...keys: string[]): string | null {
  const v = pick(o, ...keys);
  return isStr(v) ? v : null;
}
function toNumber(v: unknown, fallback = 0): number {
  if (isNum(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (isNum(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type Status = Task['statusCd'];
function toStatus(v: unknown): Status {
  const s = isStr(v) ? v.toUpperCase() : '';
  return s === 'DONE' || s === 'DOING' || s === 'TODO' ? (s as Status) : 'TODO';
}

/** 서버 → 프런트 표준화
 *  - AnyRecord(=any) 유입 차단을 위해 row를 unknown으로 받고 내부에서만 정제
 */
export function adaptInTask(row: unknown): Task {
  // row가 어떤 형태로 와도 여기서 한 번만 안전 확정
  const o: Record<string, unknown> = isObj(row) ? row : {};

  // 원시 추출(unknown → 확정)
  const rawId     = pick(o, 'taskId', 'TASK_ID', 'task_id', 'id');
  const rawOwner  = pick(o, 'ownerId', 'OWNER_ID', 'owner_id');
  const rawStatus = pick(o, 'statusCd', 'STATUS_CD', 'status_cd');

  const taskId: number = toNumber(rawId, 0);
  const ownerId: number | null = toNumberOrNull(rawOwner);
  const title: string | null = pickStr(o, 'title', 'TITLE');
  const dueDt: string | null = pickStr(o, 'dueDt', 'DUE_DT', 'due_dt');
  const grpCd: string | null = pickStr(o, 'grpCd', 'GRP_CD', 'grp_cd');
  const statusCd: Status = toStatus(rawStatus);

  const out: Task = { taskId, title, statusCd, dueDt, grpCd, ownerId };
  return out;
}