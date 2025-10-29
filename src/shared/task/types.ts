// filepath: src/shared/task/types.ts
import type { Id } from '@/shared/types/common';

export type TaskStatus = 'TODO' | 'DOING' | 'DONE';

export type Task = {
  taskId: number;
  title: string | null;
  statusCd: TaskStatus;
  dueDt: string | null;
  grpCd: string | null;
  ownerId: number | null;
};

export type TaskCreate = {
  title: string;
  dueDt?: string | null;
  grpCd?: string | null;
  /** 서버는 number만 허용하므로 Id가 와도 최종 전송은 number로 좁힌다 */
  ownerId?: Id | null;
};

export type TaskToggle = {
  taskId: Id;
  statusCd: TaskStatus;
};

export type TaskDelete = {
  taskId: Id; // 호출부에서 number로 좁혀 전송
};