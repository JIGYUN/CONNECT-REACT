// filepath: src/app/shop/order/page.tsx
'use client';

import Script from 'next/script';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? '').trim();
const apiUrl = (path: string) => (API_BASE ? `${API_BASE}${path}` : path);

const CART_API_BASE = '/api/crt/cart';
const POINT_API_BASE = '/api/plg/pointLedger';
const COUPON_API_BASE = '/api/cop/couponUser';
const ORDER_API_BASE = '/api/ord/order';
const TOSS_API_BASE = '/api/pay/toss';

// ✅ 가능하면 .env에 NEXT_PUBLIC_TOSS_CLIENT_KEY로 넣어.
// (JSP에 있던 test key를 그대로 디폴트로 넣을 수도 있지만, 배포/환경 분리를 위해 env 권장)
const TOSS_CLIENT_KEY = (process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? '').trim();

type ApiMap = {
    ok?: boolean;
    msg?: string;
    result?: unknown;
    [k: string]: unknown;
};

type OrderItem = {
    cartItemId: string;
    title: string;
    brandNm: string;
    qty: number;
    unitPrice: number;
    imgUrl: string;
    optionDesc: string;
};

type CouponUser = {
    couponUserId: number;
    couponNm: string;
    discountTypeCd: 'AMT' | 'RATE';
    discountAmt: number;
    minOrderAmt: number;
};

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const pickStr = (o: Record<string, unknown>, k: string): string => {
    const v = o[k];
    return typeof v === 'string' ? v : '';
};

const pickNum = (o: Record<string, unknown>, k: string): number => {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
};

const arrFrom = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const fmtMoney = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString();

const NO_IMAGE_URL =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22480%22 viewBox=%220 0 640 480%22%3E%3Crect width=%22640%22 height=%22480%22 fill=%22%23f3f4f6%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%239ca3af%22 font-family=%22Arial%22 font-size=%2220%22%3ENo Image%3C/text%3E%3C/svg%3E';

const toAbsUrl = (u: string) => {
    const s = u.trim();
    if (!s) return '';
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('//')) return `https:${s}`;
    if (s.startsWith('/')) return API_BASE ? `${API_BASE}${s}` : s;
    return s;
};

const resolveImg = (u: string) => {
    const s = u.trim();
    if (!s) return NO_IMAGE_URL;
    return toAbsUrl(s);
};

const postJson = async (path: string, body: Record<string, unknown>): Promise<ApiMap> => {
    const r = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    const ct = (r.headers.get('content-type') ?? '').toLowerCase();
    if (!ct.includes('application/json')) return { ok: false, msg: `HTTP ${r.status}` };

    const data: unknown = await r.json();
    if (!isRec(data)) return { ok: false, msg: 'Invalid JSON response' };
    return data;
};

const getMsg = (map: ApiMap): string => (typeof map.msg === 'string' ? map.msg : '');

const handleLoginRequired = (msg?: string): boolean => {
    if (!msg) return false;
    if (msg.includes('로그인') || msg.toLowerCase().includes('login')) {
        window.alert('로그인이 필요합니다.');
        window.location.href = '/usr/user/login';
        return true;
    }
    return false;
};

const toSafeInt = (v: string | null): number => {
    if (!v) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
};

/** =========================
 * Toss Payments(v1) 타입 (any 방지)
 * ========================= */
type TossV1Method = 'CARD' | 'TRANSFER' | 'VIRTUAL_ACCOUNT' | 'MOBILE_PHONE' | (string & {});
type TossV1RequestArgs = {
    amount: number;
    orderId: string;
    orderName: string;
    customerKey: string;
    successUrl: string;
    failUrl: string;
    [k: string]: unknown;
};
type TossPaymentsV1 = {
    requestPayment: (method: TossV1Method, args: TossV1RequestArgs) => void;
};
type TossPaymentsFactory = (clientKey: string) => TossPaymentsV1;

export default function OrderPage() {
    const sp = useSearchParams();

    // 장바구니에서 넘어온 cartItemIds: ?cartItemIds=1&cartItemIds=2 ... 혹은 ?cartIds=1,2,3 형태도 방어
    const cartItemIds = useMemo(() => {
        const multi = sp.getAll('cartItemIds').map((s) => s.trim()).filter(Boolean);
        if (multi.length > 0) return multi;

        const csv = (sp.get('cartIds') ?? '').trim();
        if (!csv) return [];
        return csv
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }, [sp]);

    const [loading, setLoading] = useState<boolean>(false);

    const [items, setItems] = useState<OrderItem[]>([]);
    const [productTotal, setProductTotal] = useState<number>(0);
    const [shipTotal, setShipTotal] = useState<number>(0);

    const [usePointAmt, setUsePointAmt] = useState<number>(0);
    const [myPointBal, setMyPointBal] = useState<number>(0);

    const [couponList, setCouponList] = useState<CouponUser[]>([]);
    const [couponUserId, setCouponUserId] = useState<number | null>(null);

    const [receiverNm, setReceiverNm] = useState<string>('');
    const [receiverTel, setReceiverTel] = useState<string>('');
    const [addr1, setAddr1] = useState<string>('');
    const [addr2, setAddr2] = useState<string>('');
    const [deliveryMemo, setDeliveryMemo] = useState<string>('');

    const selectedCoupon = useMemo(() => {
        if (couponUserId === null) return null;
        return couponList.find((c) => c.couponUserId === couponUserId) ?? null;
    }, [couponUserId, couponList]);

    const couponDiscountAmt = useMemo(() => {
        if (!selectedCoupon) return 0;
        if (selectedCoupon.minOrderAmt > productTotal) return 0;

        if (selectedCoupon.discountTypeCd === 'AMT') {
            return Math.min(selectedCoupon.discountAmt, productTotal);
        }
        // RATE
        const raw = Math.floor((productTotal * selectedCoupon.discountAmt) / 100);
        return Math.min(raw, productTotal);
    }, [selectedCoupon, productTotal]);

    const totalAmt = useMemo(() => productTotal + shipTotal, [productTotal, shipTotal]);

    const payAmt = useMemo(() => {
        const base = totalAmt - couponDiscountAmt - usePointAmt;
        return base > 0 ? base : 0;
    }, [totalAmt, couponDiscountAmt, usePointAmt]);

    const canUsePointMax = useMemo(() => {
        const max = totalAmt - couponDiscountAmt;
        return Math.max(0, Math.min(myPointBal, max));
    }, [totalAmt, couponDiscountAmt, myPointBal]);

    useEffect(() => {
        const load = async () => {
            if (cartItemIds.length <= 0) return;

            setLoading(true);
            try {
                // 1) 주문용 장바구니 조회
                const payload: Record<string, unknown> = {};
                payload['cartItemIds'] = cartItemIds;

                const map = await postJson(`${CART_API_BASE}/selectCartView`, payload);

                if (handleLoginRequired(getMsg(map))) return;

                if (map.ok !== true) {
                    window.alert(getMsg(map) || '주문 상품 조회 중 오류가 발생했습니다.');
                    setItems([]);
                    setProductTotal(0);
                    setShipTotal(0);
                    return;
                }

                const result = isRec(map.result) ? map.result : null;
                const rows = result ? arrFrom(result['rows']) : [];
                const list = rows
                    .map((r) => (isRec(r) ? r : null))
                    .filter((r): r is Record<string, unknown> => !!r)
                    .map((r): OrderItem => {
                        const cartItemId = pickStr(r, 'cartItemId') || pickStr(r, 'CART_ITEM_ID');
                        const title = pickStr(r, 'title') || pickStr(r, 'PRD_NM');
                        const brandNm = pickStr(r, 'brandNm') || pickStr(r, 'BRAND_NM');
                        const qty = pickNum(r, 'qty') || pickNum(r, 'QTY');
                        const unitPrice = pickNum(r, 'unitPrice') || pickNum(r, 'UNIT_PRICE');
                        const imgUrl = pickStr(r, 'imgUrl') || pickStr(r, 'IMG_URL');
                        const optionDesc = pickStr(r, 'optionDesc') || pickStr(r, 'OPTION_DESC');

                        return {
                            cartItemId,
                            title,
                            brandNm,
                            qty,
                            unitPrice,
                            imgUrl: resolveImg(imgUrl),
                            optionDesc,
                        };
                    });

                setItems(list);

                // 합계(혹은 백엔드가 내려주는 total 사용)
                const prdSum = list.reduce((acc, it) => acc + it.qty * it.unitPrice, 0);
                setProductTotal(prdSum);

                // 배송비(정책은 백엔드 기준을 우선)
                const deliveryAmt = result ? pickNum(result, 'deliveryAmt') : 0;
                setShipTotal(deliveryAmt);

                // 2) 내 포인트 잔액
                const pMap = await postJson(`${POINT_API_BASE}/selectMyPointBalance`, {});
                if (handleLoginRequired(getMsg(pMap))) return;

                if (pMap.ok === true) {
                    const r2 = isRec(pMap.result) ? pMap.result : null;
                    const bal = r2 ? pickNum(r2, 'pointBal') || pickNum(r2, 'balance') : 0;
                    setMyPointBal(bal);
                }

                // 3) 내 쿠폰 목록
                const cMap = await postJson(`${COUPON_API_BASE}/selectMyCouponList`, {});
                if (handleLoginRequired(getMsg(cMap))) return;

                if (cMap.ok === true) {
                    const r3 = isRec(cMap.result) ? pMap.result : null; // (원본 로직 유지/수정 필요 시 알려줘)
                    const rr = isRec(cMap.result) ? cMap.result : null;
                    const rows3 = rr ? arrFrom(rr['rows']) : [];
                    const list3 = rows3
                        .map((r) => (isRec(r) ? r : null))
                        .filter((r): r is Record<string, unknown> => !!r)
                        .map((r): CouponUser => {
                            const couponUserId = pickNum(r, 'couponUserId') || pickNum(r, 'COUPON_USER_ID');
                            const couponNm = pickStr(r, 'couponNm') || pickStr(r, 'COUPON_NM');
                            const discountTypeCdRaw = pickStr(r, 'discountTypeCd') || pickStr(r, 'DISCOUNT_TYPE_CD');
                            const discountTypeCd: 'AMT' | 'RATE' = discountTypeCdRaw === 'RATE' ? 'RATE' : 'AMT';
                            const discountAmt = pickNum(r, 'discountAmt') || pickNum(r, 'DISCOUNT_AMT');
                            const minOrderAmt = pickNum(r, 'minOrderAmt') || pickNum(r, 'MIN_ORDER_AMT');

                            return { couponUserId, couponNm, discountTypeCd, discountAmt, minOrderAmt };
                        });

                    setCouponList(list3);
                }
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [cartItemIds]);

    useEffect(() => {
        // 쿠폰/총액 변경 시 포인트 사용액이 최대를 넘지 않도록 자동 보정
        setUsePointAmt((prev) => Math.min(prev, canUsePointMax));
    }, [canUsePointMax]);

    const onClickUseAllPoint = () => setUsePointAmt(canUsePointMax);

    const validateForm = (): boolean => {
        if (items.length <= 0) {
            window.alert('주문할 상품이 없습니다.');
            return false;
        }
        if (!receiverNm.trim()) {
            window.alert('수령인 이름을 입력하세요.');
            return false;
        }
        if (!receiverTel.trim()) {
            window.alert('연락처를 입력하세요.');
            return false;
        }
        if (!addr1.trim()) {
            window.alert('주소를 입력하세요.');
            return false;
        }
        return true;
    };

    const insertOrderPointOnly = async () => {
        if (!validateForm()) return;

        const ok = window.confirm('포인트 전액 결제(0원)로 주문을 진행합니다. 계속?');
        if (!ok) return;

        setLoading(true);
        try {
            const payload: Record<string, unknown> = {
                receiverNm: receiverNm.trim(),
                receiverTel: receiverTel.trim(),
                addr1: addr1.trim(),
                addr2: addr2.trim(),
                deliveryMemo: deliveryMemo.trim(),

                orderName: items[0] ? `${items[0].title}${items.length > 1 ? ` 외 ${items.length - 1}건` : ''}` : '주문',

                totalProductAmt: productTotal,
                deliveryAmt: shipTotal,
                totalAmt,
                couponDiscountAmt,
                pointUseAmt: usePointAmt,
                payAmt,

                cartItemIds: items.map((it) => it.cartItemId),
            };

            if (couponUserId !== null) payload['couponUserId'] = couponUserId;

            const map = await postJson(`${ORDER_API_BASE}/insertOrder`, payload);

            if (handleLoginRequired(getMsg(map))) return;

            if (map.ok !== true) {
                window.alert(getMsg(map) || '주문 생성 실패');
                return;
            }

            const r = isRec(map.result) ? map.result : null;
            const orderNo = r ? pickStr(r, 'orderNo') : '';
            const qs = new URLSearchParams({
                orderNo,
                totalAmt: String(totalAmt),
                payAmt: String(payAmt),
                pointUseAmt: String(usePointAmt),
                couponUseAmt: String(couponDiscountAmt),
            }).toString();

            window.location.href = `/pay/payment/paymentModify?${qs}`;
        } finally {
            setLoading(false);
        }
    };

    // ✅ 여기서 any 발생하던 부분 해결 (fn/tp를 명시 타입으로)
    const requestTossPayment = (orderId: string, amount0: number, customerKey: string) => {
        const w = window as unknown as Record<string, unknown>;
        const fnUnknown = w['TossPayments'];

        if (typeof fnUnknown !== 'function') {
            window.alert('토스 SDK 로딩 실패');
            return;
        }

        if (!TOSS_CLIENT_KEY) {
            window.alert('NEXT_PUBLIC_TOSS_CLIENT_KEY가 비어있습니다.');
            return;
        }

        const fn = fnUnknown as unknown as TossPaymentsFactory;
        const tp: TossPaymentsV1 = fn(TOSS_CLIENT_KEY);

        const successUrl = `${window.location.origin}/pay/toss/success`;
        const failUrl = `${window.location.origin}/pay/toss/fail`;

        tp.requestPayment('CARD', {
            amount: amount0,
            orderId,
            orderName: items[0] ? `${items[0].title}${items.length > 1 ? ` 외 ${items.length - 1}건` : ''}` : '주문',
            customerKey,
            successUrl,
            failUrl,
        });
    };

    const prepareTossOrderAndPay = async () => {
        if (!validateForm()) return;

        if (payAmt <= 0) {
            // 0원이면 포인트 결제로만 처리
            await insertOrderPointOnly();
            return;
        }

        setLoading(true);
        try {
            // JSP와 동일한 구성으로 /api/pay/toss/prepare 호출 후 결제창 오픈
            const payload: Record<string, unknown> = {
                orderName: items[0] ? `${items[0].title}${items.length > 1 ? ` 외 ${items.length - 1}건` : ''}` : '주문',
                totalProductAmt: productTotal,
                deliveryAmt: shipTotal,
                totalAmt,
                couponDiscountAmt,
                pointUseAmt: usePointAmt,
                payAmt,

                receiverNm: receiverNm.trim(),
                receiverTel: receiverTel.trim(),
                addr1: addr1.trim(),
                addr2: addr2.trim(),
                deliveryMemo: deliveryMemo.trim(),

                cartItemIds: items.map((it) => it.cartItemId),
            };

            if (couponUserId !== null) payload['couponUserId'] = couponUserId;

            const map = await postJson(`${TOSS_API_BASE}/prepare`, payload);

            if (handleLoginRequired(getMsg(map))) return;

            if (!map || map.ok !== true) {
                window.alert((typeof map.msg === 'string' && map.msg) ? map.msg : '토스 결제 준비 실패');
                return;
            }

            const r = isRec(map.result) ? map.result : null;

            const orderId = r ? pickStr(r, 'orderId') || pickStr(r, 'orderNo') : '';
            const amount0 = r ? pickNum(r, 'amount') || pickNum(r, 'payAmt') : payAmt;
            const customerKey = r ? pickStr(r, 'customerKey') : '';

            if (!orderId || !customerKey) {
                window.alert('결제 준비 응답이 올바르지 않습니다.');
                return;
            }

            requestTossPayment(orderId, amount0, customerKey);
        } finally {
            setLoading(false);
        }
    };

    const onChangePoint = (v: string) => {
        const n = toSafeInt(v);
        setUsePointAmt(Math.min(Math.max(0, n), canUsePointMax));
    };

    const CART_LIST_URL = '/crt/cart/cartList';

    return (
        <div className="wrap">
            <Script src="https://js.tosspayments.com/v1/payment" strategy="afterInteractive" />

            <style jsx global>{`
                :root {
                    --bg: #f7f8fb;
                    --card: #ffffff;
                    --line: #e5e7eb;
                    --text: #0f172a;
                    --muted: #6b7280;
                    --accent: #2563eb;
                    --accent-soft: #dbeafe;
                    --danger: #ef4444;
                    --success: #16a34a;
                }

                body {
                    background: var(--bg);
                }

                .wrap {
                    max-width: 960px;
                    margin: 24px auto 80px;
                    padding: 0 12px;
                }

                .grid {
                    display: grid;
                    grid-template-columns: 1.15fr 0.85fr;
                    gap: 14px;
                }

                @media (max-width: 900px) {
                    .grid {
                        grid-template-columns: 1fr;
                    }
                }

                .card {
                    background: var(--card);
                    border: 1px solid var(--line);
                    border-radius: 18px;
                    padding: 16px;
                }

                .title {
                    font-size: 18px;
                    font-weight: 900;
                    margin: 0 0 10px;
                    color: var(--text);
                }

                .sub {
                    font-size: 12px;
                    color: var(--muted);
                    margin: -4px 0 12px;
                }

                .item {
                    display: grid;
                    grid-template-columns: 70px 1fr auto;
                    gap: 10px;
                    padding: 10px 0;
                    border-top: 1px solid var(--line);
                }

                .item:first-of-type {
                    border-top: none;
                }

                .thumb {
                    width: 70px;
                    height: 70px;
                    border-radius: 12px;
                    border: 1px solid var(--line);
                    background: #fff;
                    overflow: hidden;
                }

                .thumb img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                .i-title {
                    font-size: 13px;
                    font-weight: 900;
                    color: var(--text);
                    margin: 0 0 2px;
                    line-height: 1.2;
                }

                .i-meta {
                    font-size: 12px;
                    color: var(--muted);
                    margin: 0 0 6px;
                }

                .i-opt {
                    font-size: 12px;
                    color: #334155;
                    margin: 0;
                }

                .i-right {
                    text-align: right;
                    min-width: 92px;
                }

                .i-price {
                    font-size: 13px;
                    font-weight: 900;
                    color: var(--text);
                    margin: 0 0 4px;
                }

                .i-qty {
                    font-size: 12px;
                    color: var(--muted);
                    margin: 0;
                }

                .row {
                    display: grid;
                    grid-template-columns: 110px 1fr;
                    align-items: center;
                    gap: 10px;
                    margin: 10px 0;
                }

                .lbl {
                    font-size: 12px;
                    color: var(--muted);
                }

                .inp,
                .sel,
                .ta {
                    width: 100%;
                    border: 1px solid var(--line);
                    border-radius: 12px;
                    padding: 10px 12px;
                    font-size: 14px;
                    outline: none;
                }

                .ta {
                    min-height: 80px;
                    resize: vertical;
                }

                .two {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }

                @media (max-width: 520px) {
                    .two {
                        grid-template-columns: 1fr;
                    }
                }

                .summary-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 13px;
                    margin: 8px 0;
                }

                .summary-l {
                    color: var(--muted);
                }

                .summary-r {
                    color: var(--text);
                    font-weight: 800;
                }

                .summary-total {
                    padding-top: 10px;
                    margin-top: 10px;
                    border-top: 1px dashed var(--line);
                }

                .summary-total .summary-r {
                    font-size: 16px;
                    font-weight: 900;
                }

                .mini {
                    font-size: 12px;
                    color: var(--muted);
                    margin-top: 8px;
                    line-height: 1.4;
                }

                .btn-primary-round {
                    width: 100%;
                    border: none;
                    border-radius: 999px;
                    padding: 12px 14px;
                    font-size: 15px;
                    font-weight: 800;
                    background: var(--accent);
                    color: #fff;
                    cursor: pointer;
                }
                .btn-primary-round:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .btn-ghost-round {
                    width: 100%;
                    margin-top: 8px;
                    border-radius: 999px;
                    padding: 11px 14px;
                    font-size: 14px;
                    font-weight: 800;
                    border: 1px solid var(--line);
                    background: #fff;
                    color: var(--text);
                    cursor: pointer;
                    text-align: center;
                    text-decoration: none;
                    display: block;
                }

                .btn-link {
                    background: none;
                    border: none;
                    padding: 0;
                    color: var(--accent);
                    font-weight: 900;
                    cursor: pointer;
                }
            `}</style>

            <div className="grid">
                <div className="card">
                    <h2 className="title">주문 상품</h2>
                    <div className="sub">주문할 상품과 수량/금액을 확인하세요.</div>

                    {items.length <= 0 ? (
                        <div style={{ color: 'var(--muted)', fontSize: 13 }}>주문할 상품이 없습니다.</div>
                    ) : (
                        items.map((it) => (
                            <div key={it.cartItemId} className="item">
                                <div className="thumb">
                                    <img src={it.imgUrl} alt={it.title} />
                                </div>

                                <div>
                                    <p className="i-title">{it.title}</p>
                                    <p className="i-meta">
                                        {it.brandNm ? `${it.brandNm} · ` : ''}
                                        {it.optionDesc || '옵션 없음'}
                                    </p>
                                    <p className="i-opt">{fmtMoney(it.unitPrice)}원</p>
                                </div>

                                <div className="i-right">
                                    <p className="i-price">{fmtMoney(it.unitPrice * it.qty)}원</p>
                                    <p className="i-qty">수량 {it.qty}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="card">
                    <h2 className="title">배송지 정보</h2>
                    <div className="sub">수령인/주소/요청사항을 입력하세요.</div>

                    <div className="two">
                        <div className="row">
                            <div className="lbl">수령인</div>
                            <input className="inp" value={receiverNm} onChange={(e) => setReceiverNm(e.target.value)} />
                        </div>
                        <div className="row">
                            <div className="lbl">연락처</div>
                            <input className="inp" value={receiverTel} onChange={(e) => setReceiverTel(e.target.value)} />
                        </div>
                    </div>

                    <div className="row">
                        <div className="lbl">주소</div>
                        <input className="inp" value={addr1} onChange={(e) => setAddr1(e.target.value)} placeholder="기본 주소" />
                    </div>
                    <div className="row">
                        <div className="lbl">상세</div>
                        <input className="inp" value={addr2} onChange={(e) => setAddr2(e.target.value)} placeholder="상세 주소" />
                    </div>
                    <div className="row">
                        <div className="lbl">메모</div>
                        <textarea className="ta" value={deliveryMemo} onChange={(e) => setDeliveryMemo(e.target.value)} placeholder="배송 요청사항" />
                    </div>

                    <h2 className="title" style={{ marginTop: 16 }}>
                        할인/결제
                    </h2>

                    <div className="row">
                        <div className="lbl">쿠폰</div>
                        <select
                            className="sel"
                            value={couponUserId === null ? '' : String(couponUserId)}
                            onChange={(e) => {
                                const v = e.target.value.trim();
                                setCouponUserId(v ? Number(v) : null);
                            }}
                        >
                            <option value="">사용 안함</option>
                            {couponList.map((c) => (
                                <option key={c.couponUserId} value={String(c.couponUserId)}>
                                    {c.couponNm} (
                                    {c.discountTypeCd === 'AMT' ? `${fmtMoney(c.discountAmt)}원` : `${c.discountAmt}%`}
                                    {c.minOrderAmt > 0 ? ` / 최소 ${fmtMoney(c.minOrderAmt)}원` : ''})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="row">
                        <div className="lbl">포인트</div>
                        <div>
                            <input className="inp" value={String(usePointAmt)} onChange={(e) => onChangePoint(e.target.value)} />
                            <div className="mini">
                                잔액 {fmtMoney(myPointBal)}P / 사용가능 최대 {fmtMoney(canUsePointMax)}P{' '}
                                <button type="button" className="btn-link" onClick={onClickUseAllPoint}>
                                    전액 사용
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="summary-row">
                        <div className="summary-l">상품금액</div>
                        <div className="summary-r">{fmtMoney(productTotal)}원</div>
                    </div>
                    <div className="summary-row">
                        <div className="summary-l">배송비</div>
                        <div className="summary-r">{fmtMoney(shipTotal)}원</div>
                    </div>
                    <div className="summary-row">
                        <div className="summary-l">쿠폰 할인</div>
                        <div className="summary-r">{couponDiscountAmt > 0 ? `-${fmtMoney(couponDiscountAmt)}원` : '0원'}</div>
                    </div>
                    <div className="summary-row">
                        <div className="summary-l">포인트 사용</div>
                        <div className="summary-r">{usePointAmt > 0 ? `-${fmtMoney(usePointAmt)}원` : '0원'}</div>
                    </div>

                    <div className="summary-row summary-total">
                        <div className="summary-l">최종 결제금액</div>
                        <div className="summary-r">{fmtMoney(payAmt)}원</div>
                    </div>

                    <div className="mini">포인트로 일부 결제하고, 나머지는 카드(토스)로 결제 가능.</div>

                    <button type="button" className="btn-primary-round" onClick={() => void prepareTossOrderAndPay()} disabled={loading}>
                        {loading ? '처리중...' : payAmt <= 0 ? '포인트로 주문하기' : '토스로 결제하기'}
                    </button>

                    <a className="btn-ghost-round" href={CART_LIST_URL}>
                        장바구니로 돌아가기
                    </a>
                </div>
            </div>
        </div>
    );
}
