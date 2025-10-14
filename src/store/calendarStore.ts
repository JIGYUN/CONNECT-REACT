'use client';
import { create } from 'zustand';
import { startOfMonth, addMonths, format } from 'date-fns';

type CalState = {
  monthStart: Date;           // 현재 보고 있는 달의 1일
  selectedDate: string;       // ISO: 'YYYY-MM-DD'
  nextMonth(): void;
  prevMonth(): void;
  setMonth(d: Date): void;
  setSelected(dateISO: string): void;
  today(): void;
};

export const useCalendarStore = create<CalState>((set) => ({
  monthStart: startOfMonth(new Date()),
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  nextMonth: () => set(s => ({ monthStart: addMonths(s.monthStart, 1) })),
  prevMonth: () => set(s => ({ monthStart: addMonths(s.monthStart, -1) })),
  setMonth: (d) => set({ monthStart: startOfMonth(d) }),
  setSelected: (iso) => set({ selectedDate: iso }),
  today: () => set({ monthStart: startOfMonth(new Date()), selectedDate: format(new Date(), 'yyyy-MM-dd') }),
}));