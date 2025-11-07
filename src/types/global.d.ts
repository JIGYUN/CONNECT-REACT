/* 전역 Window 보강은 interface만 허용되므로, 이 파일에서만 규칙 해제 */
 /* eslint-disable @typescript-eslint/consistent-type-definitions */
export {};

declare global {
    interface Window {
        Android?: {
            postMessage?: (payload: string) => void;
        };
    }
}
