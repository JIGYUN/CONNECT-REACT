// filepath: src/shared/core/owner.ts
import { useSyncExternalStore } from 'react';

type OwnerId = number | null;

const STORAGE_KEY = 'ownerId';

function readOwnerId(): OwnerId {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

function writeOwnerId(id: OwnerId) {
    if (typeof window === 'undefined') return;
    if (id == null) {
        window.localStorage.removeItem(STORAGE_KEY);
    } else {
        window.localStorage.setItem(STORAGE_KEY, String(id));
    }
}

let current: OwnerId = null;
const listeners = new Set<() => void>();

function emit() {
    for (const l of listeners) l();
}

if (typeof window !== 'undefined') {
    // 초기 로드
    current = readOwnerId();

    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
            current = readOwnerId();
            emit();
        }
    });
}

export function setOwnerId(id: OwnerId) {
    current = id;
    writeOwnerId(id);
    emit();
}

export function getOwnerId(): OwnerId {
    return current;
}

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

export function useOwnerIdValue(): OwnerId {
    return useSyncExternalStore(subscribe, getOwnerId, () => null);
}