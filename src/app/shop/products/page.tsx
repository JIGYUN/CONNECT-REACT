// filepath: src/app/shop/products/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useMemo } from 'react';
import { useShopProductList, type ShopProductSummary } from '@/shared/shopProduct';

const NO_IMAGE_URL = '/static/img/no-image-150.jpg';

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

const fmtMoney = (v: number | null) => {
    if (v === null) return '-';
    return v.toLocaleString();
};

const normCurrency = (s: string | null) => (s && s.trim() ? s : 'KRW');

export default function ShopProductListPage() {
    const router = useRouter();
    const { data, isLoading, refetch } = useShopProductList({ limit: 60 });

    const list: ShopProductSummary[] = useMemo(() => data ?? [], [data]);

    const goDetail = (productId: number | null) => {
        if (productId === null) return;
        const href = `/shop/products/detail?productId=${encodeURIComponent(
            String(productId),
        )}` as Route;
        router.push(href);
    };

    return (
        <section className="container-fluid" style={{ background: 'var(--bg)' }}>
            <style jsx global>{`
                :root{
                    --bg:#f7f8fb; --card:#fff; --line:#e9edf3; --text:#0f172a; --muted:#667085;
                    --accent:#2563eb; --price:#e11d48;
                }
                body{ background:var(--bg); }

                .page-title{ font-size:24px; font-weight:800; color:var(--text); margin:14px 0 16px; }
                .toolbar{ display:flex; gap:8px; margin-bottom:12px; }

                .grid{ display:grid; grid-template-columns: repeat(5, 1fr); grid-gap: 16px; }
                @media (max-width: 1399px){ .grid{ grid-template-columns: repeat(4,1fr);} }
                @media (max-width: 1199px){ .grid{ grid-template-columns: repeat(3,1fr);} }
                @media (max-width: 991px){  .grid{ grid-template-columns: repeat(2,1fr);} }
                @media (max-width: 575px){  .grid{ grid-template-columns: 1fr; } }

                .card-item{
                    background:var(--card); border:1px solid var(--line); border-radius:16px; padding:12px;
                    transition: box-shadow .15s ease, transform .15s ease; cursor:pointer; height:100%;
                }
                .card-item:hover{ box-shadow:0 8px 24px rgba(15,23,42,.08); transform: translateY(-2px); }
                .thumb{ width:100%; height:160px; object-fit:cover; border-radius:12px; background:#fafafa; }

                .title{
                    margin:8px 0 6px; font-weight:700; color:var(--text); line-height:1.35;
                    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
                    overflow:hidden; min-height:3.4em;
                }
                .price-row{ display:flex; align-items:baseline; gap:8px; }
                .sale{ font-size:20px; font-weight:800; color:var(--price); }
                .listp{ font-size:13px; color:#94a3b8; text-decoration:line-through; }
                .meta{ font-size:12px; color:#64748b; }

                .badge-rocket{
                    font-size:11px; border:1px solid #4f46e5; color:#4f46e5;
                    border-radius:999px; padding:2px 8px; font-weight:600;
                }
                .badge-free{
                    font-size:11px; border:1px solid #10b981; color:#059669;
                    border-radius:999px; padding:2px 8px; font-weight:600;
                }

                .empty{ grid-column:1/-1; text-align:center; color:var(--muted); padding:40px 0; }
            `}</style>

            <div className="d-flex justify-content-between align-items-center">
                <h2 className="page-title">쇼핑몰 상품</h2>
            </div>

            {isLoading && (
                <div className="text-center py-4 text-muted">불러오는 중…</div>
            )}

            {!isLoading && list.length === 0 && (
                <div className="grid">
                    <div className="empty">등록된 상품이 없습니다.</div>
                </div>
            )}

            {!isLoading && list.length > 0 && (
                <div className="grid">
                    {list.map((r, idx) => {
                        const productId =
                            typeof r.productId === 'number' && Number.isFinite(r.productId)
                                ? r.productId
                                : null;

                        const sourceCd = r.sourceCd ?? '';
                        const shipFee = r.shipFee ?? 0;
                        const salePrice = r.salePrice ?? 0;
                        const listPrice = r.listPrice;
                        const currency = normCurrency(r.currencyCd);

                        const ratingAvg = r.ratingAvg;
                        const reviewCnt = r.reviewCnt ?? 0;

                        const title = r.title ?? '';
                        const mainImg = resolveImg(r.mainImgUrl ?? null);

                        const rocket = sourceCd === 'CPNG';
                        const free = shipFee === 0;

                        const showListPrice =
                            typeof listPrice === 'number' &&
                            Number.isFinite(listPrice) &&
                            listPrice > salePrice;

                        const ratingOk =
                            typeof ratingAvg === 'number' &&
                            Number.isFinite(ratingAvg) &&
                            ratingAvg > 0;

                        return (
                            <div
                                key={productId !== null ? `p-${productId}` : `p-idx-${idx}`}
                                className="card-item"
                                onClick={() => goDetail(productId)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') goDetail(productId);
                                }}
                            >
                                <img
                                    className="thumb"
                                    src={mainImg}
                                    alt={title || '상품 이미지'}
                                    onError={(e) => {
                                        const t = e.currentTarget;
                                        t.onerror = null;
                                        t.src = NO_IMAGE_URL;
                                    }}
                                />

                                <div className="title">{title}</div>

                                <div className="price-row">
                                    <div className="sale">
                                        {fmtMoney(salePrice)} {currency}
                                    </div>
                                    {showListPrice && (
                                        <span className="listp">
                                            {fmtMoney(listPrice)} {currency}
                                        </span>
                                    )}
                                </div>

                                <div className="meta d-flex justify-content-between">
                                    <div>
                                        {ratingOk ? (
                                            <>
                                                ★ {ratingAvg.toFixed(2)}{' '}
                                                <span className="meta">({reviewCnt})</span>
                                            </>
                                        ) : (
                                            ''
                                        )}
                                    </div>
                                    <div>
                                        {rocket && <span className="badge-rocket">로켓</span>}
                                        {rocket && free ? ' ' : ''}
                                        {free && <span className="badge-free">무료배송</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
