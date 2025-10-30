// filepath: src/shared/core/owner.ts
import { useSyncExternalStore } from 'react';

/**
 * OwnerId = 현재 로그인한 유저의 식별자.
 * - 로그인 안 되어 있으면 null
 * - number만 유효
 */
export type OwnerId = number | null;

const STORAGE_KEY = 'ownerId';

/* ───────────────────────────────────────────
 * 로컬스토리지 <-> 메모리 싱크 유틸
 * ───────────────────────────────────────────*/

/** localStorage → OwnerId 로드 */
function readOwnerId(): OwnerId {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

/** OwnerId → localStorage 저장/삭제 */
function writeOwnerId(id: OwnerId): void {
    if (typeof window === 'undefined') return;
    if (id == null) {
        window.localStorage.removeItem(STORAGE_KEY);
    } else {
        window.localStorage.setItem(STORAGE_KEY, String(id));
    }
}

/* ───────────────────────────────────────────
 * 전역 상태 저장소 (브라우저 전용 싱글톤)
 * ───────────────────────────────────────────*/

let current: OwnerId = null;
const listeners: Set<() => void> = new Set();

/** 모든 구독자에게 변경 신호 */
function emit(): void {
    for (const l of listeners) {
        l();
    }
}

// 브라우저 환경에서 초기화 + storage 이벤트로 동기화
if (typeof window !== 'undefined') {
    // 첫 로드시 localStorage 값 반영
    current = readOwnerId();

    // 다른 탭에서 변경되면 반영
    window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) {
            current = readOwnerId();
            emit();
        }
    });
}

/* ───────────────────────────────────────────
 * 쓰기/읽기 함수 (컴포넌트 밖에서도 호출 가능)
 * ───────────────────────────────────────────*/

/** ownerId 설정 (로그인 직후 userId 넣을 때 사용) */
export function setOwnerId(id: OwnerId): void {
    current = id;
    writeOwnerId(id);
    emit();
}

/** ownerId 제거 (로그아웃 시 사용) */
export function clearOwnerId(): void {
    // 우리 규칙: null만 쓴다. undefined 금지.
    setOwnerId(null);
}

/** 현재 메모리 상의 ownerId 반환 (구독 없이 단발 조회용) */
export function getOwnerId(): OwnerId {
    return current;
}

/* ───────────────────────────────────────────
 * React 훅: 컴포넌트에서 실시간 ownerId 구독
 * ───────────────────────────────────────────*/

/** 내부 subscribe: useSyncExternalStore가 호출 */
function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}

/**
 * 컴포넌트에서 ownerId 값을 읽는 훅
 * - 클라이언트에서는 current를 그대로 구독
 * - 서버/SSR 단계에서는 항상 null을 fallback으로 준다
 */
export function useOwnerIdValue(): OwnerId {
    return useSyncExternalStore<OwnerId>(
        subscribe,
        getOwnerId,
        () => null
    );
}
