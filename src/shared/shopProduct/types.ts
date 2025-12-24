import type { Id } from '@/shared/types/common';

export type ShopProductSummary = {
    productId: Id | null;
    title: string | null;
    salePrice: number | null;
    listPrice: number | null;
    currencyCd: string | null;
    ratingAvg: number | null;
    reviewCnt: number | null;
    shipFee: number | null;
    sourceCd: string | null;
    mainImgUrl: string | null;
};

export type ShopProductDetail = {
    productId: Id | null;

    title: string | null;
    brandNm: string | null;

    salePrice: number | null;
    listPrice: number | null;
    currencyCd: string | null;

    ratingAvg: number | null;
    reviewCnt: number | null;

    shipFee: number | null;
    sourceCd: string | null;
    grpCd: string | null;

    mainImgUrl: string | null;
    productUrl: string | null;

    descriptionTxt: string | null;
};

export type CartAddItemInput = {
    productId: number;
    qty: number;
};

export type CartAddItemResult = {
    msg: string | null;
    cartItemId: number | null;
};
