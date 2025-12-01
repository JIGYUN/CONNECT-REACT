export {};

declare global {
    interface Window {
        Android?: {
            postMessage?: (payload: string) => void;
        };
    }
}
