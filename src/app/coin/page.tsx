// filepath: src/app/coin/ripple/page.tsx
'use client';

import { Suspense, useMemo, useState } from 'react';
import RouteFallback from '@/shared/ui/RouteFallback';

export const dynamic = 'force-dynamic';

type TF = '1D' | '1W' | '1M';

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
function makeSeries(seed: number, points: number, drift = 0, vol = 0.9) {
  const rand = prng(seed);
  const arr: number[] = [];
  let v = 100;
  for (let i = 0; i < points; i++) {
    const shock = (rand() - 0.5) * 2 * vol;
    v = Math.max(80, v + shock + drift);
    arr.push(v);
  }
  return arr;
}
function tfToConfig(tf: TF) {
  if (tf === '1D') return { seed: 9471, points: 48, drift: 0.1, vol: 0.8 };
  if (tf === '1W') return { seed: 13579, points: 60, drift: 0.05, vol: 1.0 };
  return { seed: 24680, points: 90, drift: -0.02, vol: 0.9 };
}
function pct(a: number, b: number) {
  return ((b - a) / a) * 100;
}
function fmt(n: number, d = 2) {
  return n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
}

function Card(props: { title?: string; children: React.ReactNode; style?: React.CSSProperties; right?: React.ReactNode }) {
  return (
    <div className="card" style={props.style}>
      {(props.title || props.right) && (
        <div className="card-head">
          {props.title ? <div className="card-title">{props.title}</div> : <div />}
          {props.right ?? null}
        </div>
      )}
      {props.children}
      <style jsx>{`
        .card {
          min-width: 0; /* 🔑 grid overflow 방지 */
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.06);
        }
        .card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          gap: 12px;
          flex-wrap: wrap; /* 🔑 좁은 폭에서 우측 요소 줄바꿈 */
        }
        .card-title {
          font-weight: 700;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

function Tag({
  tone = 'neutral',
  children,
}: {
  tone?: 'up' | 'down' | 'neutral' | 'buy' | 'hold' | 'sell';
  children: React.ReactNode;
}) {
  const palette: any = {
    up: { bg: '#ecfdf5', bd: '#a7f3d0', fg: '#047857' },
    down: { bg: '#fef2f2', bd: '#fecaca', fg: '#b91c1c' },
    neutral: { bg: '#f3f4f6', bd: '#e5e7eb', fg: '#374151' },
    buy: { bg: '#eff6ff', bd: '#bfdbfe', fg: '#1d4ed8' },
    hold: { bg: '#fefce8', bd: '#fde68a', fg: '#92400e' },
    sell: { bg: '#fef2f2', bd: '#fecaca', fg: '#991b1b' },
  };
  const c = palette[tone];
  return (
    <span
      style={{
        fontSize: 12,
        padding: '4px 8px',
        borderRadius: 999,
        fontWeight: 700,
        background: c.bg,
        border: `1px solid ${c.bd}`,
        color: c.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function Sparkline({ data, height = 120 }: { data: number[]; height?: number }) {
  const w = Math.max(240, data.length * 6);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const up = data[data.length - 1] >= data[0];
  const stroke = up ? '#10b981' : '#ef4444';
  const fill = up ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.10)';
  const path = `M0,${height} L${points} L${w},${height} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <path d={path} fill={fill} />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2.5" />
    </svg>
  );
}

type Indicators = {
  rsi: number;
  ma20: number;
  ma50: number;
  momentum: number;
  volScore: number;
  price: number;
  changePct: number;
  volume: number;
};

function scoreDecision(ind: Indicators) {
  let score = 0;
  if (ind.rsi < 30) score += 25;
  else if (ind.rsi > 70) score -= 20;
  else score += 10;
  if (ind.ma20 > ind.ma50) score += 25;
  else score -= 10;
  score += ind.momentum * 6;
  if (ind.volScore >= 40 && ind.volScore <= 70) score += 15;
  else if (ind.volScore > 80) score -= 5;
  if (ind.changePct < -0.5 && ind.changePct > -3.5) score += 8;
  if (ind.changePct > 6) score -= 8;

  const final = Math.max(0, Math.min(100, Math.round(score + 50)));
  let decision: 'BUY' | 'HOLD' | 'SELL' = 'HOLD';
  if (final >= 66) decision = 'BUY';
  else if (final <= 34) decision = 'SELL';
  return { final, decision };
}

function RippleDashboardInner() {
  const [tf, setTf] = useState<TF>('1D');
  const [seedBump, setSeedBump] = useState(0);

  const series = useMemo(() => {
    const cfg = tfToConfig(tf);
    return makeSeries(cfg.seed + seedBump, cfg.points, cfg.drift, cfg.vol);
  }, [tf, seedBump]);

  const priceBase = 850;
  const last = series[series.length - 1];
  const first = series[0];
  const change = pct(first, last);
  const price = priceBase * (last / 100);

  const ma20 = series.slice(-20).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(20, series.length));
  const ma50 = series.slice(-50).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(50, series.length));
  const mom = (last - series[Math.max(0, series.length - 6)]) / 10;
  const gains = series.slice(1).map((v, i) => Math.max(0, v - series[i]));
  const losses = series.slice(1).map((v, i) => Math.max(0, series[i] - v));
  const avgGain = gains.reduce((a, b) => a + b, 0) / Math.max(1, gains.length);
  const avgLoss = losses.reduce((a, b) => a + b, 0) / Math.max(1, losses.length);
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = Math.max(0, Math.min(100, 100 - 100 / (1 + rs)));
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  const stdev = Math.sqrt(series.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / series.length);
  const volScore = Math.max(10, Math.min(95, (stdev / 2) * 10 + 40));

  const indicators: Indicators = {
    rsi,
    ma20,
    ma50,
    momentum: mom,
    volScore,
    price,
    changePct: change,
    volume: Math.round(120_000_000 + stdev * 2_000_000),
  };
  const { final, decision } = scoreDecision(indicators);

  return (
    <div className="wrap">
      <div className="container">
        {/* 헤더 */}
        <div className="head">
          <div>
            <div className="muted">시연용 가상 대시보드</div>
            <h1 className="title">XRP / 리플 — 지금 살까?</h1>
          </div>
          <div className="head-actions">
            <button className="btn" onClick={() => setSeedBump((v) => v + 1)} aria-label="가상 데이터 재생성">
              재생성
            </button>
            <div className="tf">
              {(['1D', '1W', '1M'] as TF[]).map((k) => (
                <button key={k} onClick={() => setTf(k)} aria-pressed={tf === k} className={tf === k ? 'tf-btn active' : 'tf-btn'}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 상단: 가격/결론 + 차트 */}
        <div className="grid-hero">
          <Card title="가격 & 결론(가상)">
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{fmt(indicators.price, 0)}원</div>
                <Tag tone={indicators.changePct >= 0 ? 'up' : 'down'}>
                  {indicators.changePct >= 0 ? '+' : ''}
                  {fmt(indicators.changePct, 2)}%
                </Tag>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 auto' }}>
                  <svg width={1} height={1} style={{ position: 'absolute', opacity: 0 }} />
                  {/* 게이지 */}
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  {/* Gauge를 카드 안에서 넉넉히 보이도록 */}
                  <Gauge value={final} />
                </div>
                <div style={{ minWidth: 180 }}>
                  <div className="muted">의사결정 점수(가상)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 6px' }}>{final} / 100</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {decision === 'BUY' && <Tag tone="buy">BUY(매수 우위)</Tag>}
                    {decision === 'HOLD' && <Tag tone="hold">HOLD(관망)</Tag>}
                    {decision === 'SELL' && <Tag tone="sell">SELL(매도 우위)</Tag>}
                  </div>
                </div>
              </div>

              <div className="note">
                <b>요약(가상)</b> · RSI {Math.round(indicators.rsi)}, MA20 vs MA50 {indicators.ma20 > indicators.ma50 ? '상방' : '하방'},
                모멘텀 {indicators.momentum >= 0 ? '양호' : '둔화'}, 변동성 점수 {Math.round(indicators.volScore)}.
                {decision === 'BUY' && ' 분할매수 관점의 유리 구간 시그널(시연)입니다.'}
                {decision === 'HOLD' && ' 방향 모니터링 권장. 관망 유지(시연).'}
                {decision === 'SELL' && ' 단기 과열/약세 시그널. 리스크 관리 권장(시연).'}
              </div>
            </div>
          </Card>

          <Card title="가격 추세(가상)" right={<Tag tone="neutral">{tf}</Tag>} style={{ overflow: 'hidden' }}>
            <Sparkline data={series} height={140} />
          </Card>
        </div>

        {/* 지표 그리드 */}
        <div className="grid-metrics">
          <Card title="RSI">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{Math.round(indicators.rsi)}</div>
              <div className="muted">0~100</div>
            </div>
            <div className="bar">
              <div
                className="bar-fill"
                style={{
                  width: `${indicators.rsi}%`,
                  background: indicators.rsi < 30 ? '#10b981' : indicators.rsi > 70 ? '#ef4444' : '#111827',
                }}
              />
            </div>
          </Card>

          <Card title="이동평균(MA)">
            <div style={{ display: 'grid', gap: 6 }}>
              <div className="row">
                <span className="muted">MA20</span>
                <b>{fmt(indicators.ma20, 2)}</b>
              </div>
              <div className="row">
                <span className="muted">MA50</span>
                <b>{fmt(indicators.ma50, 2)}</b>
              </div>
              <div style={{ marginTop: 6 }}>{indicators.ma20 > indicators.ma50 ? <Tag tone="up">상방(유리)</Tag> : <Tag tone="down">하방(보수)</Tag>}</div>
            </div>
          </Card>

          <Card title="모멘텀">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{fmt(indicators.momentum, 2)}</div>
              <div className="muted">-5 ~ +5</div>
            </div>
            <div style={{ marginTop: 8 }}>{indicators.momentum >= 0 ? <Tag tone="up">상승 기울기</Tag> : <Tag tone="down">하락 기울기</Tag>}</div>
          </Card>

          <Card title="거래량(가상)">
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{indicators.volume.toLocaleString()} XRP</div>
              <div className="muted">변동성 점수: {Math.round(indicators.volScore)}</div>
            </div>
          </Card>
        </div>

        {/* 하단: 체크리스트 + 가상 뉴스 */}
        <div className="grid-bottom">
          <Card title="체크리스트(시연)">
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, fontSize: 14 }}>
              <li>리스크 관리: 포지션 규모 <b>분할</b>, 손절/리밸런싱 규칙 사전 정의</li>
              <li>시간 프레임 일치: 단기 트레이딩이면 <b>{tf}</b> 시그널, 장기면 월봉/분기 관점 보조 검토</li>
              <li>이벤트 캘린더: 상장/규제/소송/메이저 업데이트 일정(본 대시보드는 <b>전부 가상</b>)</li>
              <li>심리/군중: 급등 추격 금지, 평균회귀 구간에서 <b>분할</b> 접근</li>
              <li>유동성/슬리피지: 체결 환경 확인(시연이므로 데이터 미연결)</li>
            </ul>
            <div className="muted" style={{ marginTop: 12 }}>
              ※ 본 페이지는 <b>디자인·동작 시연용</b>입니다. 모든 수치·판단은 임의 생성된 가상 값입니다.
            </div>
          </Card>

          <Card title="가상 뉴스 스니펫">
            <div className="news">
              <div className="news-item">
                <div className="news-title">[가상] 해외 대형 거래소, XRP 마켓 메이킹 개선</div>
                <div className="muted">유동성 확대 기대감… 단, 단기 변동성↑ 주의</div>
              </div>
              <div className="news-item">
                <div className="news-title">[가상] 온체인 활동 증가</div>
                <div className="muted">일일 활성 주소 추정치 상승(시연 데이터)</div>
              </div>
              <div className="news-item">
                <div className="news-title">[가상] 파트너십 루머</div>
                <div className="muted">사실 여부 불명확 — 확인 전 추격 매수 지양</div>
              </div>
            </div>
          </Card>
        </div>

        <div className="footer">© CONNECT · Prototype · All numbers are MOCKED for demo.</div>
      </div>

      {/* scoped styles */}
      <style jsx>{`
        .wrap {
          min-height: 100dvh;
          background: #f6f8fb;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 16px 48px;
        }
        .head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          gap: 12px;
          flex-wrap: wrap; /* 🔑 헤더 줄바꿈 허용 */
        }
        .title {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.2px;
          margin: 2px 0 0;
        }
        .muted {
          font-size: 12px;
          color: #6b7280;
        }
        .head-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap; /* 🔑 버튼/탭 겹침 방지 */
        }
        .btn {
          height: 36px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          background: #fff;
          font-weight: 700;
        }
        .tf {
          display: flex;
          gap: 6px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 4px;
        }
        .tf-btn {
          height: 28px;
          padding: 0 10px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: #111827;
          font-weight: 700;
        }
        .tf-btn.active {
          background: #111827;
          color: #fff;
        }

        /* 🔑 반응형 그리드 */
        .grid-hero {
          display: grid;
          gap: 16px;
          grid-template-columns: 1fr 1.4fr; /* 넓을 때 2열 */
        }
        @media (max-width: 1100px) {
          .grid-hero {
            grid-template-columns: 1fr; /* 좁아지면 1열 */
          }
        }

        .grid-metrics {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); /* 🔑 카드 자동 줄바꿈 */
          margin-top: 16px;
        }

        .grid-bottom {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); /* 🔑 체크리스트/뉴스 자동 줄바꿈 */
          margin-top: 16px;
        }

        .bar {
          height: 6px;
          background: #f3f4f6;
          border-radius: 999px;
          margin-top: 10px;
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          border-radius: 999px;
        }

        .news {
          display: grid;
          gap: 10px;
        }
        .news-item {
          padding: 10px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #fafafa;
        }
        .news-title {
          font-weight: 700;
          font-size: 13px;
          margin-bottom: 4px;
        }

        .note {
          padding: 12px;
          border: 1px dashed #e5e7eb;
          border-radius: 10px;
          background: #f9fafb;
          line-height: 1.5;
          font-size: 13px;
        }

        .footer {
          margin-top: 20px;
          font-size: 12px;
          color: #6b7280;
          text-align: right;
        }
      `}</style>
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const start = Math.PI;
  const end = 0;
  const ratio = clamped / 100;
  const angle = start + (end - start) * ratio;
  const cx = 60,
    cy = 60,
    r = 52;
  const x = cx + r * Math.cos(angle);
  const y = cy + r * Math.sin(angle);

  return (
    <svg width={140} height={80} viewBox="0 0 120 70">
      <path d="M8,60 A52,52 0 0 1 112,60" fill="none" stroke="#e5e7eb" strokeWidth="14" strokeLinecap="round" />
      <path d="M8,60 A52,52 0 0 1 112,60" fill="none" stroke="#111827" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${Math.max(1, 163 * ratio)} 200`} />
      <line x1={60} y1={60} x2={x} y2={y} stroke="#111827" strokeWidth="3" />
      <circle cx={60} cy={60} r={4} fill="#111827" />
      <text x={60} y={66} textAnchor="middle" fontSize="10" fill="#374151">
        {Math.round(clamped)} / 100
      </text>
    </svg>
  );
}

export default function RippleDashboardPage() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <RippleDashboardInner />
    </Suspense>
  );
}
