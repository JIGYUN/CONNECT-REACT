// filepath: src/shared/ledger/types.ts
export type IoType = 'IN' | 'OUT';
export type Yn = 'Y' | 'N';

/**
 * 서버에서 내려오는 가계부 행의 프런트 표준 타입
 * - 모든 필드 안전하게 nullable/optional로 정의 (어댑터에서 정제)
 */
export type LedgerRow = {
  txnId?: number;
  accountNm: string | null;
  categoryNm: string | null;
  amount: number | null;
  ioType: IoType;
  fixedAt: Yn;
  currencyCd: string | null;
  txnDt: string | null;       // YYYY-MM-DD
  ledgerDate: string | null;  // YYYY-MM-DD
  createDate: string | null;  // YYYY-MM-DD
  createdDt: string | null;   // YYYY-MM-DD (서버 생성 기준)
  grpCd: string | null;
  ownerId?: number;
};

/**
 * 프런트 → 서버 전송(생성/수정) 페이로드
 * - 필수만 엄격, 나머지는 서버 기본값 허용
 */
export type LedgerCreate = {
  txnId?: number;                 // 업데이트 시 사용
  accountNm: string;
  categoryNm: string | null;
  amount: number;
  ioType: IoType;
  fixedAt?: Yn;                   // 기본 'N'
  currencyCd?: string;            // 기본 'KRW'
  txnDt: string;                  // YYYY-MM-DD
  ledgerDate?: string;            // 미지정 시 txnDt
  createDate?: string;            // 미지정 시 txnDt
  grpCd?: string | null;          // 개인인 경우 null
  ownerId: number;
};

// 레거시 호환(기존 코드가 LedgerUpsert를 참조하는 경우)
export type LedgerUpsert = LedgerCreate;