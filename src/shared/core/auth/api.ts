// filepath: src/shared/core/auth/api.ts
import apiClient, { postJson } from '@/shared/core/apiClient';
import { setOwnerId, clearOwnerId } from '@/shared/core/owner';

export type ApiRes<T = any> = { ok: boolean; result?: T; user?: any; msg?: string };

// 로그인: 서버가 해시 처리하므로 평문을 passwordHash로 전달(기존 계약 가정)
export async function apiLogin(email: string, password: string): Promise<ApiRes> {
  const r = await postJson('/api/auth/selectLogin', { email, passwordHash: password });
  // 응답에서 사용자 식별자를 얻을 수 있으면 로컬에 저장(가드에서 사용)
  const userId =
    (r as any)?.result?.userId ??
    (r as any)?.user?.userId ??
    (r as any)?.data?.userId ??
    null;
  if (userId != null) setOwnerId(userId);
  return r as unknown as ApiRes;
}

// 로그아웃: 서버 엔드포인트 없으면 클라 상태만 정리
export async function apiLogout(): Promise<ApiRes> {
  try { await apiClient.post('/api/auth/logout'); } catch {}
  clearOwnerId();
  return { ok: true };
}

// 세션 체크: 백엔드에 me가 없으므로 호출하지 않음(필요하면 얕은 핑으로 대체 가능)
export async function hasSession(): Promise<boolean> {
  // 선택: 아주 가벼운 엔드포인트가 있다면 여기서 try/catch로 검사
  // 지금은 클라이언트 저장값(OwnerId) 기반으로 가드가 동작하므로 false 고정 반환
  return false;
}