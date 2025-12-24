// filepath: src/shared/shopProduct/api/queries.ts
import {
    useMutation,
    useQuery,
    type QueryKey,
} from '@tanstack/react-query';
import { postJson } from '@/shared/core/apiClient';
import type {
    CartAddItemInput,
    CartAddItemResult,
    ShopProductDetail,
    ShopProductSummary,
} from '@/shared/shopProduct/types';
import {
    adaptInCartAddItemResult,
    adaptInShopProductDetail,
    adaptInShopProductSummary,
} from '@/shared/shopProduct/adapters';

const isRec = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null;

function cleanObj<T extends Record<string, unknown>>(o: T): T {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
        const v = o[k];
        if (v !== undefined) out[k] = v;
    }
    return out as T;
}

/**
 * 서버 응답에서 리스트 후보를 최대 5단계 언랩
 * - 절대 any로 흘러가면 안 되므로 반환은 unknown 유지
 */
function unwrapList(x: unknown): unknown {
    if (Array.isArray(x)) return x;
    if (isRec(x) && Array.isArray(x['result'])) return x['result'];
    if (isRec(x) && Array.isArray(x['rows'])) return x['rows'];
    if (isRec(x) && Array.isArray(x['list'])) return x['list'];

    if (isRec(x) && isRec(x['result'])) return unwrapList(x['result']);
    if (isRec(x) && isRec(x['data'])) return unwrapList(x['data']);
    if (isRec(x) && isRec(x['item'])) return unwrapList(x['item']);

    return x;
}

/**
 * 서버 응답에서 row 후보를 최대 5단계 언랩
 * - 반환은 unknown 유지
 */
function unwrapRow(x: unknown): unknown {
    let cur: unknown = x;
    for (let i = 0; i < 5; i++) {
        if (!isRec(cur)) break;

        const hasWrap =
            isRec(cur['result']) || isRec(cur['data']) || isRec(cur['item']);

        if (hasWrap) {
            cur =
                (cur['result'] as unknown) ||
                (cur['data'] as unknown) ||
                (cur['item'] as unknown);
            continue;
        }

        break;
    }
    return cur;
}

function extractListToProducts(v: unknown): ShopProductSummary[] {
    const list = unwrapList(v);
    if (!Array.isArray(list)) return [];

    // ✅ Array.isArray 내부의 list는 any[]로 잡히기 쉬움 → unknown[]로 고정
    const arr: unknown[] = list as unknown[];
    return arr.map((row) => adaptInShopProductSummary(row));
}

function extractOneToDetail(v: unknown): ShopProductDetail | null {
    const cur = unwrapRow(v);

    if (Array.isArray(cur)) {
        // ✅ any[] 방지: unknown[]로 고정
        const arr: unknown[] = cur as unknown[];
        const first: unknown | undefined = arr.length > 0 ? arr[0] : undefined;
        return first !== undefined ? adaptInShopProductDetail(first) : null;
    }

    if (isRec(cur)) return adaptInShopProductDetail(cur);
    return null;
}

const API = {
    list: '/api/prd/product/selectProductList',
    detail: '/api/prd/product/selectProductDetail',
};

const CART_API = {
    addItem: '/api/crt/cart/addItem',
};

function keyProductList(limit: number): QueryKey {
    return ['shopProduct/list', limit];
}

function keyProductDetail(productId: number): QueryKey {
    return ['shopProduct/detail', productId];
}

async function getProductList(limit: number): Promise<ShopProductSummary[]> {
    const body = cleanObj({
        limit,
    });

    const data = await postJson<unknown>(API.list, body);
    return extractListToProducts(data);
}

export function useShopProductList(p?: { limit?: number }) {
    const limitRaw = p?.limit;
    const limit =
        typeof limitRaw === 'number' && Number.isFinite(limitRaw) && limitRaw > 0
            ? Math.floor(limitRaw)
            : 60;

    return useQuery<ShopProductSummary[], Error>({
        queryKey: keyProductList(limit),
        queryFn: () => getProductList(limit),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: 5000,
    });
}

async function getProductDetail(productId: number): Promise<ShopProductDetail | null> {
    const body = cleanObj({
        productId,
    });

    const data = await postJson<unknown>(API.detail, body);
    return extractOneToDetail(data);
}

export function useShopProductDetail(p: { productId: number | null }) {
    const pid = p.productId;

    return useQuery<ShopProductDetail | null, Error>({
        queryKey: pid !== null ? keyProductDetail(pid) : ['shopProduct/detail', null],
        queryFn: () => {
            if (pid === null) return Promise.resolve(null);
            return getProductDetail(pid);
        },
        enabled: pid !== null,
        retry: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: 2000,
    });
}

async function addCartItem(input: CartAddItemInput): Promise<CartAddItemResult> {
    const qty =
        typeof input.qty === 'number' && Number.isFinite(input.qty)
            ? Math.max(1, Math.min(99, Math.floor(input.qty)))
            : 1;

    const body = cleanObj({
        productId: input.productId,
        qty,
    });

    const data = await postJson<unknown>(CART_API.addItem, body);

    // 서버가 { msg, cartItemId } 형태로 내려주므로 그대로 파싱
    if (isRec(data)) return adaptInCartAddItemResult(data);

    // 혹시 result 래핑이면 언랩
    const cur = unwrapRow(data);
    return adaptInCartAddItemResult(cur);
}

export function useAddCartItem() {
    return useMutation<CartAddItemResult, Error, CartAddItemInput>({
        mutationFn: (v) => addCartItem(v),
    });
}
