import type {
    CartAddItemResult,
    ShopProductDetail,
    ShopProductSummary,
} from '@/shared/shopProduct/types';

const isRec = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null;

function pickStr(o: Record<string, unknown>, keys: string[]): string | null {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v.trim() !== '') return v;
    }
    return null;
}

function pickNum(o: Record<string, unknown>, keys: string[]): number | null {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string') {
            const n = Number(v);
            if (Number.isFinite(n)) return n;
        }
    }
    return null;
}

/** result/data/item 래핑을 최대 5단계 언랩 */
function unwrapRow(row: unknown): Record<string, unknown> {
    let cur: unknown = row;
    for (let i = 0; i < 5; i++) {
        if (!isRec(cur)) break;
        const next =
            (isRec(cur['result']) && cur['result']) ||
            (isRec(cur['data']) && cur['data']) ||
            (isRec(cur['item']) && cur['item']);
        if (next) {
            cur = next;
            continue;
        }
        break;
    }
    return isRec(cur) ? cur : {};
}

export function adaptInShopProductSummary(row: unknown): ShopProductSummary {
    const o = unwrapRow(row);

    const productId = pickNum(o, ['PRODUCT_ID', 'productId', 'productid', 'id']);
    const title = pickStr(o, ['TITLE', 'title']);
    const salePrice = pickNum(o, ['SALE_PRICE', 'salePrice', 'saleprice']);
    const listPrice = pickNum(o, ['LIST_PRICE', 'listPrice', 'listprice']);
    const currencyCd = pickStr(o, ['CURRENCY_CD', 'currencyCd', 'currencycd']);
    const ratingAvg = pickNum(o, ['RATING_AVG', 'ratingAvg', 'ratingavg']);
    const reviewCnt = pickNum(o, ['REVIEW_CNT', 'reviewCnt', 'reviewcnt']);
    const shipFee = pickNum(o, ['SHIP_FEE', 'shipFee', 'shipfee']);
    const sourceCd = pickStr(o, ['SOURCE_CD', 'sourceCd', 'sourcecd']);
    const mainImgUrl = pickStr(o, ['MAIN_IMG_URL', 'mainImgUrl', 'mainimgurl']);

    return {
        productId: productId ?? null,
        title: title ?? null,
        salePrice: salePrice ?? null,
        listPrice: listPrice ?? null,
        currencyCd: currencyCd ?? null,
        ratingAvg: ratingAvg ?? null,
        reviewCnt: reviewCnt ?? null,
        shipFee: shipFee ?? null,
        sourceCd: sourceCd ?? null,
        mainImgUrl: mainImgUrl ?? null,
    };
}

export function adaptInShopProductDetail(row: unknown): ShopProductDetail {
    const o = unwrapRow(row);

    const productId = pickNum(o, ['PRODUCT_ID', 'productId', 'productid', 'id']);

    const title = pickStr(o, ['TITLE', 'title']);
    const brandNm = pickStr(o, ['BRAND_NM', 'brandNm', 'brandnm']);

    const salePrice = pickNum(o, ['SALE_PRICE', 'salePrice', 'saleprice']);
    const listPrice = pickNum(o, ['LIST_PRICE', 'listPrice', 'listprice']);
    const currencyCd = pickStr(o, ['CURRENCY_CD', 'currencyCd', 'currencycd']);

    const ratingAvg = pickNum(o, ['RATING_AVG', 'ratingAvg', 'ratingavg']);
    const reviewCnt = pickNum(o, ['REVIEW_CNT', 'reviewCnt', 'reviewcnt']);

    const shipFee = pickNum(o, ['SHIP_FEE', 'shipFee', 'shipfee']);
    const sourceCd = pickStr(o, ['SOURCE_CD', 'sourceCd', 'sourcecd']);
    const grpCd = pickStr(o, ['GRP_CD', 'grpCd', 'grpcd']);

    const mainImgUrl = pickStr(o, ['MAIN_IMG_URL', 'mainImgUrl', 'mainimgurl']);
    const productUrl = pickStr(o, ['PRODUCT_URL', 'productUrl', 'producturl']);

    const descriptionTxt = pickStr(o, [
        'DESCRIPTION_TXT',
        'descriptionTxt',
        'descriptiontxt',
    ]);

    return {
        productId: productId ?? null,

        title: title ?? null,
        brandNm: brandNm ?? null,

        salePrice: salePrice ?? null,
        listPrice: listPrice ?? null,
        currencyCd: currencyCd ?? null,

        ratingAvg: ratingAvg ?? null,
        reviewCnt: reviewCnt ?? null,

        shipFee: shipFee ?? null,
        sourceCd: sourceCd ?? null,
        grpCd: grpCd ?? null,

        mainImgUrl: mainImgUrl ?? null,
        productUrl: productUrl ?? null,

        descriptionTxt: descriptionTxt ?? null,
    };
}

export function adaptInCartAddItemResult(v: unknown): CartAddItemResult {
    const o = isRec(v) ? v : {};
    const msgRaw = o['msg'];
    const msg = typeof msgRaw === 'string' ? msgRaw : null;

    const cartItemIdRaw = o['cartItemId'];
    let cartItemId: number | null = null;
    if (typeof cartItemIdRaw === 'number' && Number.isFinite(cartItemIdRaw)) {
        cartItemId = cartItemIdRaw;
    } else if (typeof cartItemIdRaw === 'string') {
        const n = Number(cartItemIdRaw);
        cartItemId = Number.isFinite(n) ? n : null;
    }

    return {
        msg,
        cartItemId,
    };
}
