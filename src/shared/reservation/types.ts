import type { Id } from '@/shared/types/common';

export type ReservationEntry = {
    reservationId?: Id | null;
    grpCd?: string | null;
    ownerId?: number | null;
    title?: string | null;
    content?: string | null;
    resourceNm?: string | null;
    capacityCnt?: number | null;
    resvStartDt?: string | null;
    resvEndDt?: string | null;
    statusCd?: string | null;
    alertBeforeMin?: number | null;
    useAt?: string | null;
    createdDt?: string | null;
    createdBy?: number | null;
    updatedDt?: string | null;
    updatedBy?: number | null;
};

export type ReservationUpsertInput = {
    diaryDt: string;
    content: string;
    grpCd?: string;
    ownerId?: Id | null;
};
