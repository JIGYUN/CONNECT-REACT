// filepath: src/shared/core/config.ts
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  // 로컬 백엔드 기본값(필요시 수정)
  'http://192.168.26.28:8080';

export const DEFAULT_GRP_CD =
  process.env.NEXT_PUBLIC_GRP_CD ?? 'sikyung';