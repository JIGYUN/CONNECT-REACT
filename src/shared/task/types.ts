/* filepath: src/app/features/task/types.ts */
export type Task = {
  taskId: number;
  title: string | null;
  statusCd: 'TODO' | 'DONE' | string;
  dueDt?: string | null;      // 'YYYY-MM-DD HH:mm[:ss]' or ISO
  grpCd?: string | null;
  ownerId?: number | null;
};

export type TaskCreate = {
  title: string;
  dueDt: string;              // 'YYYY-MM-DDTHH:mm' or 'YYYY-MM-DD HH:mm'
  grpCd?: string | null;
  ownerId?: number;
};

export type TaskToggle = {
  taskId: number;
  statusCd: 'TODO' | 'DONE';
  ownerId?: number;
};

export type TaskDelete = {
  taskId: number;
  ownerId?: number;
};