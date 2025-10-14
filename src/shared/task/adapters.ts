/* filepath: src/app/features/task/adapters.ts */
import type { Task } from './types';

/** 서버 → 프론트 표준화 */
export function adaptInTask(x: any): Task {
  const taskId =
    x?.taskId ?? x?.TASK_ID ?? x?.task_id ?? x?.id;

  const title =
    x?.title ?? x?.TITLE ?? null;

  const statusCd: string =
    x?.statusCd ?? x?.STATUS_CD ?? x?.status_cd ?? 'TODO';

  const dueDt: string | null =
    x?.dueDt ?? x?.DUE_DT ?? x?.due_dt ?? null;

  const grpCd: string | null =
    x?.grpCd ?? x?.GRP_CD ?? x?.grp_cd ?? null;

  const ownerId: number | null =
    x?.ownerId ?? x?.OWNER_ID ?? x?.owner_id ?? null;

  return {
    taskId: Number(taskId),
    title: title ?? null,
    statusCd: statusCd as any,
    dueDt,
    grpCd,
    ownerId: ownerId !== null ? Number(ownerId) : null,
  };
}