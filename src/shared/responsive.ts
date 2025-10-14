/* filepath: src/shared/responsive.ts */
'use client';

import { useEffect, useState } from 'react';

export const MOBILE_MAX_WIDTH = 768;

export function isLikelyMobileUA(ua?: string) {
  const s = (ua || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).toLowerCase();
  return /iphone|ipad|ipod|android|mobile|blackberry|mini|windows ce|palm/.test(s);
}

/** 화면 너비 기준으로 모바일 여부 판단 (초기값은 UA 힌트로 추정 → 첫 렌더 깜빡임 완화) */
export function useIsMobile(breakpoint = MOBILE_MAX_WIDTH) {
  const [isMobile, setIsMobile] = useState<boolean>(isLikelyMobileUA());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width:${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, [breakpoint]);

  return isMobile;
}