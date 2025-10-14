/* filepath: src/shared/core/owner.ts */
'use client';

import { useSyncExternalStore } from 'react';

const CK = 'ownerId';
const COMMON_PATHS = ['/', '/ledger', '/task', '/diary', '/boardPost', '/login'];

let _owner: string | null = null;
const listeners = new Set<() => void>();

function notify() { listeners.forEach(l => l()); }
function getCookieVal(): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';').map(s => s.trim());
  // 동일 키가 여러 개면 '마지막 것'을 채택
  let last: string | null = null;
  for (const p of parts) if (p.startsWith(CK + '=')) last = decodeURIComponent(p.slice(CK.length + 1));
  return last;
}
function readSnapshot(): string | null {
  if (_owner != null) return _owner;
  const c = getCookieVal();
  if (c != null && c !== '') return (_owner = c);
  try {
    const ls = localStorage.getItem(CK);
    return (_owner = (ls ?? null));
  } catch { return (_owner = null); }
}

export function setOwnerId(v: string | number) {
  const val = encodeURIComponent(String(v));
  // 흔한 Path에 남아있을 쿠키 정리
  try {
    const now = location.pathname || '/';
    for (const p of new Set([...COMMON_PATHS, now])) {
      document.cookie = `${CK}=; Path=${p}; Max-Age=0; SameSite=Lax`;
    }
  } catch {}
  // 루트로 재기록
  document.cookie = `${CK}=${val}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  try { localStorage.setItem(CK, String(v)); } catch {}
  _owner = String(v);
  notify();
}

export function clearOwnerId() {
  try {
    const now = location.pathname || '/';
    for (const p of new Set([...COMMON_PATHS, now])) {
      document.cookie = `${CK}=; Path=${p}; Max-Age=0; SameSite=Lax`;
    }
  } catch {}
  try { localStorage.removeItem(CK); } catch {}
  _owner = null;
  notify();
}

export function readOwnerId(): string | null {
  // 비구독 읽기가 필요할 때 사용(레거시)
  return readSnapshot();
}

/** ✅ 변화를 ‘구독’하는 리액티브 훅 */
export function useOwnerIdValue(): number | null {
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    // 다른 탭/창에서 localStorage가 바뀌면 동기화
    const onStorage = (e: StorageEvent) => { if (e.key === CK) { _owner = e.newValue; notify(); } };
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
  };
  const get = () => readSnapshot();
  const id = useSyncExternalStore(subscribe, get, get);
  return id != null && id !== '' && !Number.isNaN(Number(id)) ? Number(id) : null;
}