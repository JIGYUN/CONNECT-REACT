// filepath: src/app/shop/products/detail/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAddCartItem, useShopProductDetail } from '@/shared/shopProduct';

const NO_IMAGE_URL = '/static/img/no-image-600x400.png';
const CART_LIST_URL = '/crt/cart/cartList';
const LOGIN_URL = '/mba/auth/login';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_BASE ?? '').trim();

const toAbsUrl = (u: string) => {
    const s = u.trim();
    if (!s) return '';
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('//')) return `https:${s}`;
    if (s.startsWith('/')) return API_ORIGIN ? `${API_ORIGIN}${s}` : s;
    return s;
};

const resolveImg = (u: string | null) => {
    const s = (u ?? '').trim();
    if (!s) return NO_IMAGE_URL;
    return toAbsUrl(s);
};

type TabKey = 'desc' | 'review' | 'qna';

const fmtMoney = (v: number) => v.toLocaleString();

const clampQty = (n: number) => {
    if (!Number.isFinite(n)) return 1;
    const x = Math.floor(n);
    if (x <= 0) return 1;
    if (x > 99) return 99;
    return x;
};

const sourceLabel = (sourceCd: string | null) => {
    const s = (sourceCd ?? '').trim();
    if (!s) return '';
    if (s === 'CPNG') return '쿠팡';
    if (s === 'GMRK') return 'G마켓';
    if (s === 'NVSH') return '네이버쇼핑';
    return s;
};

export default function ShopProductDetailPage() {
    const sp = useSearchParams();
    const pidRaw = sp.get('productId') ?? '';

    const productId = useMemo(() => {
        const n = Number(pidRaw);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    }, [pidRaw]);

    const { data, isLoading } = useShopProductDetail({ productId });
    const addCart = useAddCartItem();

    const [qty, setQty] = useState(1);
    const [tab, setTab] = useState<TabKey>('desc');

    const d = data;

    const title = d?.title ?? '상품명 미등록';
    const brandNm = d?.brandNm ?? '';
    const salePrice = d?.salePrice ?? 0;
    const listPrice = d?.listPrice;
    const currencyCd = d?.currencyCd && d.currencyCd.trim() ? d.currencyCd : 'KRW';

    const ratingAvg = d?.ratingAvg;
    const reviewCnt = d?.reviewCnt ?? 0;

    const shipFee = d?.shipFee ?? 0;

    const src = resolveImg(d?.mainImgUrl ?? null);

    const srcLabel = sourceLabel(d?.sourceCd ?? null);
    const grpCd = d?.grpCd ?? '';
    const sourceText = srcLabel ? `${srcLabel}${grpCd ? ` · ${grpCd}` : ''}` : grpCd ? grpCd : '상품 정보';

    const rocket = d?.sourceCd === 'CPNG';
    const free = shipFee === 0;

    const showListPrice =
        typeof listPrice === 'number' &&
        Number.isFinite(listPrice) &&
        listPrice > salePrice;

    const ratingOk =
        typeof ratingAvg === 'number' &&
        Number.isFinite(ratingAvg) &&
        ratingAvg > 0;

    const productTotal = salePrice * qty;
    const total = productTotal + shipFee;
    const point = Math.floor(productTotal * 0.01);

    const onChangeQtyText = (v: string) => {
        const n = Number(v);
        setQty(clampQty(n));
    };

    const handleLoginRequired = (msg: string | null) => {
        if (msg === 'LOGIN_REQUIRED') {
            window.alert('로그인이 필요한 서비스입니다.');
            window.location.href = LOGIN_URL;
            return true;
        }
        return false;
    };

    const doAddToCart = async () => {
        if (productId === null) return;
        if (addCart.isPending) return;

        const r = await addCart.mutateAsync({ productId, qty });

        if (handleLoginRequired(r.msg)) return;

        if (r.msg !== '성공') {
            window.alert(r.msg || '장바구니 담기 중 오류가 발생했습니다.');
            return;
        }

        const ok = window.confirm('장바구니에 담았습니다.\n장바구니로 이동하시겠습니까?');
        if (ok) window.location.href = CART_LIST_URL;
    };

    const doBuyNow = async () => {
        if (productId === null) return;
        if (addCart.isPending) return;

        const r = await addCart.mutateAsync({ productId, qty });

        if (handleLoginRequired(r.msg)) return;

        if (r.msg !== '성공') {
            window.alert(r.msg || '구매 준비 중 오류가 발생했습니다.');
            return;
        }

        if (r.cartItemId === null) {
            window.location.href = '/ord/order/orderModify';
            return;
        }

        window.location.href = `/ord/order/orderModify?cartIds=${encodeURIComponent(
            String(r.cartItemId),
        )}`;
    };

    if (productId === null) {
        return (
            <div className="container" style={{ padding: '16px 12px' }}>
                <div className="alert alert-warning mb-0">
                    잘못된 접근입니다. productId가 없습니다.
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrap">
            <style jsx global>{`
                :root {
                    --bg: #f7f8fb;
                    --card: #ffffff;
                    --line: #e5e7eb;
                    --text: #0f172a;
                    --muted: #6b7280;
                    --accent: #2563eb;
                    --price: #e11d48;
                }
                body { background: var(--bg); }

                .page-wrap {
                    max-width: 1100px;
                    margin: 16px auto 40px;
                    padding: 0 12px;
                }

                .breadcrumb-sm {
                    font-size: 12px;
                    color: var(--muted);
                    margin-bottom: 6px;
                }

                .product-header {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 24px;
                }

                .product-image-wrap {
                    flex: 0 0 380px;
                    max-width: 380px;
                }

                .product-main-card {
                    background: var(--card);
                    border-radius: 16px;
                    border: 1px solid var(--line);
                    padding: 16px;
                }

                .product-main-img {
                    width: 100%;
                    height: 340px;
                    object-fit: contain;
                    border-radius: 12px;
                    background: #f9fafb;
                }

                .thumb-badges {
                    margin-top: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 11px;
                    color: var(--muted);
                }

                .badge-rocket {
                    font-size: 11px;
                    border: 1px solid #4f46e5;
                    color: #4f46e5;
                    border-radius: 999px;
                    padding: 2px 8px;
                    font-weight: 600;
                }

                .badge-free {
                    font-size: 11px;
                    border: 1px solid #10b981;
                    color: #059669;
                    border-radius: 999px;
                    padding: 2px 8px;
                    font-weight: 600;
                    margin-left: 4px;
                }

                .product-info-wrap {
                    flex: 1;
                    min-width: 260px;
                }

                .product-source {
                    font-size: 12px;
                    color: var(--muted);
                    margin-bottom: 4px;
                }

                .product-title {
                    font-size: 20px;
                    font-weight: 800;
                    color: var(--text);
                    line-height: 1.4;
                    margin-bottom: 6px;
                }

                .product-brand {
                    font-size: 13px;
                    color: var(--muted);
                    margin-bottom: 8px;
                }

                .product-rating {
                    font-size: 13px;
                    color: #f97316;
                    margin-bottom: 10px;
                }

                .product-rating .meta {
                    font-size: 12px;
                    color: var(--muted);
                    margin-left: 4px;
                }

                .price-block {
                    padding: 12px 14px;
                    border-radius: 14px;
                    background: var(--card);
                    border: 1px solid var(--line);
                    margin-bottom: 10px;
                }

                .price-row {
                    display: flex;
                    align-items: baseline;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .price-sale {
                    font-size: 26px;
                    font-weight: 800;
                    color: var(--price);
                }

                .price-list {
                    font-size: 13px;
                    color: #9ca3af;
                    text-decoration: line-through;
                }

                .price-currency {
                    font-size: 13px;
                    color: var(--muted);
                }

                .ship-info {
                    margin-top: 6px;
                    font-size: 13px;
                    color: var(--muted);
                }

                .ship-info span {
                    font-weight: 600;
                }

                .point-info {
                    margin-top: 6px;
                    font-size: 13px;
                    color: #047857;
                }

                .qty-card {
                    background: var(--card);
                    border-radius: 14px;
                    border: 1px solid var(--line);
                    padding: 12px 14px;
                    margin-top: 10px;
                }

                .qty-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .qty-input-group {
                    display: flex;
                    align-items: center;
                    border-radius: 999px;
                    border: 1px solid var(--line);
                    overflow: hidden;
                    background: #f9fafb;
                }

                .qty-btn {
                    width: 32px;
                    height: 30px;
                    border: none;
                    background: transparent;
                    font-size: 16px;
                    line-height: 1;
                    cursor: pointer;
                }

                .qty-value {
                    width: 56px;
                    border-left: 1px solid var(--line);
                    border-right: 1px solid var(--line);
                    text-align: center;
                    font-size: 14px;
                    background: #ffffff;
                    outline: none;
                }

                .total-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    margin-top: 8px;
                }

                .total-label {
                    font-size: 13px;
                    color: var(--muted);
                }

                .total-price {
                    font-size: 22px;
                    font-weight: 800;
                    color: #111827;
                }

                .action-row {
                    display: flex;
                    gap: 8px;
                    margin-top: 14px;
                }

                .btn-cart {
                    flex: 1;
                    border-radius: 999px;
                    border-width: 1px;
                    font-size: 14px;
                    font-weight: 600;
                }

                .btn-buy {
                    flex: 1;
                    border-radius: 999px;
                    font-size: 14px;
                    font-weight: 700;
                }

                .product-origin-link {
                    margin-top: 10px;
                    text-align: right;
                    font-size: 12px;
                }

                .product-origin-link a {
                    color: var(--accent);
                    text-decoration: underline;
                }

                .detail-tabs {
                    margin-top: 32px;
                }

                .detail-body {
                    background: var(--card);
                    border-radius: 16px;
                    border: 1px solid var(--line);
                    padding: 18px;
                    margin-top: -1px;
                }

                .desc-body img {
                    max-width: 100%;
                    height: auto;
                }

                @media (max-width: 767px) {
                    .product-header { flex-direction: column; }
                    .product-image-wrap { max-width: 100%; }
                }
            `}</style>

            <div className="breadcrumb-sm">홈 &gt; 쇼핑몰 &gt; 상품 상세</div>

            {isLoading && (
                <div className="text-center py-4 text-muted">불러오는 중…</div>
            )}

            {!isLoading && !d && (
                <div className="alert alert-warning">
                    상품 조회 중 오류가 발생했습니다.
                </div>
            )}

            {!isLoading && d && (
                <>
                    <div className="product-header">
                        <div className="product-image-wrap">
                            <div className="product-main-card">
                                <img
                                    className="product-main-img"
                                    src={src}
                                    alt="상품 이미지"
                                    onError={(e) => {
                                        const t = e.currentTarget;
                                        t.onerror = null;
                                        t.src = NO_IMAGE_URL;
                                    }}
                                />
                                <div className="thumb-badges">
                                    <div>
                                        {rocket && <span className="badge-rocket">로켓</span>}
                                        {free && <span className="badge-free">무료배송</span>}
                                    </div>
                                    <div>{srcLabel}</div>
                                </div>
                            </div>

                            <div className="product-origin-link">
                                {d.productUrl ? (
                                    <a href={d.productUrl} target="_blank" rel="noreferrer">
                                        원본 상품 페이지 열기 &raquo;
                                    </a>
                                ) : null}
                            </div>
                        </div>

                        <div className="product-info-wrap">
                            <div className="product-source">{sourceText}</div>
                            <div className="product-title">{title}</div>
                            <div className="product-brand">
                                {brandNm ? `브랜드: ${brandNm}` : ''}
                            </div>

                            {ratingOk ? (
                                <div className="product-rating">
                                    ★ {ratingAvg.toFixed(2)}
                                    <span className="meta"> · 리뷰 {fmtMoney(reviewCnt)}개</span>
                                </div>
                            ) : null}

                            <div className="price-block">
                                <div className="price-row">
                                    <div className="price-sale">{fmtMoney(salePrice)}원</div>
                                    <div className="price-currency">{currencyCd}</div>
                                    {showListPrice ? (
                                        <div className="price-list">{fmtMoney(listPrice)}원</div>
                                    ) : null}
                                </div>

                                <div
                                    className="ship-info"
                                    dangerouslySetInnerHTML={{
                                        __html:
                                            shipFee === 0
                                                ? '<span>무료배송</span> · 도서/산간 일부 추가 배송비 발생 가능'
                                                : `배송비 <span>${fmtMoney(shipFee)}원</span>`,
                                    }}
                                />

                                <div className="point-info">
                                    {point > 0
                                        ? `구매 시 약 ${fmtMoney(point)} P 적립 예정 (추후 포인트 시스템 연동)`
                                        : ''}
                                </div>
                            </div>

                            <div className="qty-card">
                                <div className="qty-row">
                                    <div className="font-weight-bold">수량</div>
                                    <div className="qty-input-group">
                                        <button
                                            type="button"
                                            className="qty-btn"
                                            onClick={() => setQty((v) => clampQty(v - 1))}
                                        >
                                            -
                                        </button>
                                        <input
                                            className="qty-value"
                                            value={String(qty)}
                                            onChange={(e) => onChangeQtyText(e.target.value)}
                                            inputMode="numeric"
                                            aria-label="수량"
                                        />
                                        <button
                                            type="button"
                                            className="qty-btn"
                                            onClick={() => setQty((v) => clampQty(v + 1))}
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>

                                <div className="total-row">
                                    <div className="total-label">총 상품금액 (배송비 포함)</div>
                                    <div className="total-price">{fmtMoney(total)}원</div>
                                </div>
                            </div>

                            <div className="action-row">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-cart"
                                    onClick={() => void doAddToCart()}
                                    disabled={addCart.isPending}
                                >
                                    {addCart.isPending ? '처리 중…' : '장바구니'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-buy"
                                    onClick={() => void doBuyNow()}
                                    disabled={addCart.isPending}
                                >
                                    {addCart.isPending ? '처리 중…' : '바로 구매'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="detail-tabs">
                        <ul className="nav nav-tabs" role="tablist">
                            <li className="nav-item">
                                <button
                                    type="button"
                                    className={`nav-link ${tab === 'desc' ? 'active' : ''}`}
                                    onClick={() => setTab('desc')}
                                >
                                    상세정보
                                </button>
                            </li>
                            <li className="nav-item">
                                <button
                                    type="button"
                                    className={`nav-link ${tab === 'review' ? 'active' : ''}`}
                                    onClick={() => setTab('review')}
                                >
                                    리뷰 (예정)
                                </button>
                            </li>
                            <li className="nav-item">
                                <button
                                    type="button"
                                    className={`nav-link ${tab === 'qna' ? 'active' : ''}`}
                                    onClick={() => setTab('qna')}
                                >
                                    문의 (예정)
                                </button>
                            </li>
                        </ul>

                        <div className="detail-body">
                            {tab === 'desc' ? (
                                <>
                                    {d.descriptionTxt && d.descriptionTxt.trim() ? (
                                        <div
                                            className="desc-body"
                                            dangerouslySetInnerHTML={{ __html: d.descriptionTxt }}
                                        />
                                    ) : (
                                        <div className="text-muted">등록된 상세 설명이 없습니다.</div>
                                    )}
                                </>
                            ) : null}

                            {tab === 'review' ? (
                                <p className="text-muted mb-0">리뷰/평점 기능은 추후 구현 예정입니다.</p>
                            ) : null}

                            {tab === 'qna' ? (
                                <p className="text-muted mb-0">상품 문의 기능은 추후 구현 예정입니다.</p>
                            ) : null}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
