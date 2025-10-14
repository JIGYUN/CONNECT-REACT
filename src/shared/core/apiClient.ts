import axios, { AxiosRequestConfig } from 'axios';
import { API_BASE, DEFAULT_GRP_CD, USE_ENVELOPE } from './config';

const apiClient = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
});

// grpCd 자동 부착
apiClient.interceptors.request.use((config) => {
    const base = config.baseURL ?? "";
    const raw = config.url ?? "";
    const url = new URL(base + raw, "http://x");
    if (!url.searchParams.get("grpCd") && DEFAULT_GRP_CD) {
        url.searchParams.set("grpCd", DEFAULT_GRP_CD);
    }
    config.url = url.pathname + (url.search || "");
    return config;
}); 

// {msg,result,page?} → {ok:true,result,page?,msg} 로 평탄화
apiClient.interceptors.response.use(
    (res) => {
        const data = res.data;
        if (!USE_ENVELOPE) return data;

        if (data && typeof data === "object") {
            if ("ok" in data && "result" in data) return data;
            const out: any = {
                ok: true,
                result: "result" in data ? (data as any).result : data,
                msg: "msg" in data ? (data as any).msg : null,
            };
            if ("page" in data) out.page = (data as any).page;
            return out;
        }
        return { ok: true, result: data, msg: null };
    },
    (err) => {
        const msg = err?.response?.data?.msg ?? err?.message ?? "Request failed";
        return Promise.reject({ ok: false, result: null, msg });
    }
);

// 편의 함수(선택)
export const postJson = <T=any>(url: string, data?: any, cfg?: AxiosRequestConfig) =>
    apiClient.post<any, { ok: boolean; result: T; msg?: string }>(url, data ?? {}, cfg);

export const postForm = <T=any>(url: string, form: FormData, cfg?: AxiosRequestConfig) =>
    apiClient.post<any, { ok: boolean; result: T; msg?: string }>(url, form, cfg);

export default apiClient;