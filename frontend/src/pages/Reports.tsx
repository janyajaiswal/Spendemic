/**
 * Reports — Chronos-2 spending forecast with confidence bands + historical breakdown.
 */
import { useState, useEffect, useCallback } from 'react';
import '../styles/reports.css';
import {
  ComposedChart, Bar, Area, Line, LineChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingUp, GraduationCap, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API = 'http://localhost:8000/api/v1';
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthLabel(year: number, month: number) {
  return `${MONTH_NAMES[month - 1]} '${String(year).slice(2)}`;
}
function weekLabel(year: number, week: number) {
  // Compute Monday of that ISO week, then derive month abbreviation
  const jan4 = new Date(year, 0, 4);
  const startOfW1 = new Date(jan4);
  startOfW1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
  const monday = new Date(startOfW1.getTime() + (week - 1) * 7 * 86400000);
  return `W${week} ${MONTH_NAMES[monday.getMonth()]}`;
}
function usd(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────
interface HistoryPoint  { year: number; month?: number; week?: number; total: number; synthetic: boolean }
interface Prediction    { year: number; month?: number; week?: number; month_offset?: number; week_offset?: number; lower: number; median: number; upper: number }
interface ForecastResp  { history: HistoryPoint[]; predictions: Prediction[]; prediction_months?: number; prediction_weeks?: number; granularity: string; graduation_date: string | null; warnings: string[] }
interface WeeklySummaryRow { year: number; week: number; week_start: string; week_end: string; total: number }
interface LoanMonthPoint { month: number; year: number; remaining: number }
interface LoanProjection { months_remaining: number; payoff_date: string; monthly_schedule: LoanMonthPoint[] }

interface ChartPoint {
  label: string;
  actual?:    number;   // historical bar
  median?:    number;   // forecast line
  lower?:     number;   // confidence band base (transparent)
  bandWidth?: number;   // upper - lower (visible band)
  isForecast: boolean;
}

// ─────────────────────────────────────────────────────
// Custom Tooltip
// ─────────────────────────────────────────────────────
function isLight() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function ForecastTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as ChartPoint;
  const light = isLight();
  return (
    <div style={{
      background: light ? '#fff' : '#0d3533',
      border: `1px solid ${light ? 'rgba(14,76,73,0.18)' : 'rgba(255,227,180,0.15)'}`,
      borderRadius: 8, padding: '10px 14px', fontSize: 13,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    }}>
      <div style={{ color: light ? '#0e4c49' : '#ffe3b4', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {d.actual != null && (
        <div style={{ color: light ? '#5a3d2b' : '#ecc7b0' }}>Actual: <b>{usd(d.actual)}</b></div>
      )}
      {d.median != null && (
        <>
          <div style={{ color: light ? '#0e4c49' : '#ffe3b4' }}>Forecast: <b>{usd(d.median)}</b></div>
          {d.lower != null && d.bandWidth != null && (
            <div style={{ color: light ? 'rgba(14,76,73,0.55)' : 'rgba(236,199,176,0.55)', fontSize: 11 }}>
              Range: {usd(d.lower)} – {usd(d.lower + d.bandWidth)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Card component
// ─────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card-ombre" style={{
      background: 'var(--bg-card)',
      borderRadius: 12,
      padding: '20px 24px',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────
export default function Reports() {
  const { user } = useAuth();
  const [forecast, setForecast]             = useState<ForecastResp | null>(null);
  const [gradForecast, setGradForecast]     = useState<ForecastResp | null>(null);
  const [weeklySummary, setWeeklySummary]   = useState<WeeklySummaryRow[] | null>(null);
  const [granularity, setGranularity]       = useState<'weekly' | 'monthly'>('weekly');
  const [predMonths, setPredMonths]         = useState(3);
  const [predWeeks, setPredWeeks]           = useState(8);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [loanProjection, setLoanProjection] = useState<LoanProjection | null>(null);

  const headers: HeadersInit = { Authorization: `Bearer ${user?.accessToken ?? ''}` };

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = granularity === 'weekly'
        ? `${API}/forecast?granularity=weekly&prediction_weeks=${predWeeks}`
        : `${API}/forecast?granularity=monthly&prediction_months=${predMonths}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).detail ?? `Error ${res.status}`);
      }
      setForecast(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load forecast');
    } finally {
      setLoading(false);
    }
  }, [user?.accessToken, granularity, predMonths, predWeeks]);

  const fetchGradForecast = useCallback(async () => {
    try {
      const res = await fetch(`${API}/forecast/to-graduation`, { headers });
      if (res.ok) setGradForecast(await res.json());
    } catch { /* graduation date not set — silently skip */ }
  }, [user?.accessToken]);

  const fetchWeeklySummary = useCallback(async () => {
    try {
      const res = await fetch(`${API}/transactions/weekly-summary`, { headers });
      if (res.ok) setWeeklySummary(await res.json());
    } catch { /* silent */ }
  }, [user?.accessToken]);

  useEffect(() => {
    if (user?.accessToken) {
      fetchForecast();
      fetchGradForecast();
      if (granularity === 'weekly') fetchWeeklySummary();
      // Load loan projection once
      fetch(`${API}/users/me/loan-projection`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d && d.months_remaining > 0) setLoanProjection(d); })
        .catch(() => {});
    }
  }, [granularity, predMonths, predWeeks, fetchForecast, fetchGradForecast, fetchWeeklySummary]);

  // ── Build combined chart data ──────────────────────
  const chartData: ChartPoint[] = forecast ? [
    ...forecast.history.map(h => ({
      label: granularity === 'weekly' && h.week != null
        ? weekLabel(h.year, h.week)
        : monthLabel(h.year, h.month ?? 1),
      actual: h.total,
      isForecast: false,
    })),
    ...forecast.predictions.map(p => ({
      label: granularity === 'weekly' && p.week != null
        ? weekLabel(p.year, p.week)
        : monthLabel(p.year, p.month ?? 1),
      median:    p.median,
      lower:     p.lower,
      bandWidth: p.upper - p.lower,
      isForecast: true,
    })),
  ] : [];

  // ── Summary stats ──────────────────────────────────
  const totalProjected  = forecast?.predictions.reduce((s, p) => s + p.median, 0) ?? 0;
  const avgProjected    = forecast?.predictions.length
    ? totalProjected / forecast.predictions.length : 0;
  const peakPeriod      = forecast?.predictions.reduce(
    (max, p) => p.median > max.median ? p : max,
    forecast.predictions[0] ?? { median: 0, year: 0, month: 1, week: 1 }
  );

  const gradTotal       = gradForecast?.predictions.reduce((s, p) => s + p.median, 0) ?? 0;
  const gradMonths      = gradForecast?.predictions.length ?? 0;

  // ── Find the boundary label for the reference line ─
  const boundaryLabel = forecast?.predictions[0]
    ? granularity === 'weekly' && forecast.predictions[0].week != null
      ? weekLabel(forecast.predictions[0].year, forecast.predictions[0].week)
      : monthLabel(forecast.predictions[0].year, forecast.predictions[0].month ?? 1)
    : null;

  // ─────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────
  return (
    <div style={{ padding: '32px 36px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <TrendingUp size={24} color="var(--accent)" />
        <div style={{ flex: 1 }}>
          <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.5em', fontWeight: 700, letterSpacing: '-0.3px' }}>Spending Reports & Forecast</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8em', margin: 0, opacity: 0.65 }}>
            Powered by Amazon Chronos-2 · historical actuals + probabilistic predictions
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {(['weekly', 'monthly'] as const).map(g => (
            <button key={g} onClick={() => setGranularity(g)} style={{
              padding: '7px 14px', fontSize: '0.83em', borderRadius: 8, fontFamily: 'inherit',
              background: granularity === g ? 'var(--accent)' : 'transparent',
              color:      granularity === g ? 'var(--teal-900)' : 'var(--text-secondary)',
              border:     granularity === g ? 'none' : '1px solid var(--border)',
              fontWeight: granularity === g ? 700 : 500, cursor: 'pointer',
            }}>
              {g === 'weekly' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
          <button
            onClick={() => fetchForecast()}
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83em', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Warning banners ── */}
      {forecast?.warnings?.map((w, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '0.83em', color: '#f59e0b',
        }}>
          <AlertTriangle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
          {w}
        </div>
      ))}

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 8, padding: '10px 14px', color: '#f87171', marginBottom: 16, fontSize: '0.83em',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {/* ── Summary cards ── */}
      {forecast && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          <Card>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.7em', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6, opacity: 0.6 }}>
              Total Projected ({granularity === 'weekly' ? `${predWeeks}wk` : `${predMonths}mo`})
            </div>
            <div style={{ color: 'var(--text-primary)', fontSize: '1.55em', fontWeight: 700, letterSpacing: '-0.4px' }}>{usd(totalProjected)}</div>
          </Card>
          <Card>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.7em', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6, opacity: 0.6 }}>
              {granularity === 'weekly' ? 'Avg / Week' : 'Avg / Month'}
            </div>
            <div style={{ color: 'var(--text-primary)', fontSize: '1.55em', fontWeight: 700, letterSpacing: '-0.4px' }}>{usd(avgProjected)}</div>
          </Card>
          <Card>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.7em', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6, opacity: 0.6 }}>
              {granularity === 'weekly' ? 'Peak Forecast Week' : 'Peak Forecast Month'}
            </div>
            <div style={{ color: 'var(--text-primary)', fontSize: '1.55em', fontWeight: 700, letterSpacing: '-0.4px' }}>
              {peakPeriod
                ? (granularity === 'weekly' && peakPeriod.week != null
                    ? weekLabel(peakPeriod.year, peakPeriod.week)
                    : monthLabel(peakPeriod.year, peakPeriod.month ?? 1))
                : '—'}
            </div>
            {peakPeriod && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.83em', opacity: 0.6 }}>{usd(peakPeriod.median)}</div>
            )}
          </Card>
        </div>
      )}

      {/* ── Data gate: require ≥ 14 days of history ── */}
      {!loading && !error && (() => {
        const historyPoints = forecast?.history?.filter(h => !h.synthetic).length ?? 0;
        const daysEstimate = granularity === 'weekly' ? historyPoints * 7 : historyPoints * 30;
        if (daysEstimate < 14 && historyPoints < 2) {
          const daysNeeded = 14;
          const pct = Math.min(100, Math.round((daysEstimate / daysNeeded) * 100));
          return (
            <Card style={{ marginBottom: 24, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1em', marginBottom: 8 }}>
                Add at least 2 weeks of transactions to unlock AI forecasting
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.83em', marginBottom: 16, opacity: 0.65 }}>
                Chronos-2 needs enough history to detect spending patterns. Keep logging transactions!
              </div>
              <div style={{ background: 'rgba(255,227,180,0.08)', borderRadius: 99, height: 6, overflow: 'hidden', maxWidth: 320, margin: '0 auto 8px' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>{pct}% of data needed</div>
            </Card>
          );
        }
        return null;
      })()}

      {/* ── Main Forecast Chart ── */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95em' }}>
              {granularity === 'weekly' ? 'Weekly' : 'Monthly'} Spending — History & Forecast
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75em', marginTop: 2, opacity: 0.6 }}>
              Gray bars = actual · Cream line = forecast median · Shaded band = confidence interval
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {granularity === 'weekly'
              ? [4, 8, 12, 26].map(w => (
                  <button key={w} onClick={() => setPredWeeks(w)} style={{
                    padding: '5px 12px', fontSize: '0.8em', borderRadius: 7, fontFamily: 'inherit', cursor: 'pointer',
                    background: predWeeks === w ? 'var(--accent)' : 'transparent',
                    color:      predWeeks === w ? 'var(--teal-900)' : 'var(--text-secondary)',
                    border:     predWeeks === w ? 'none' : '1px solid var(--border)',
                    fontWeight: predWeeks === w ? 700 : 500,
                  }}>{w}wk</button>
                ))
              : [3, 6, 12].map(m => (
                  <button key={m} onClick={() => setPredMonths(m)} style={{
                    padding: '5px 14px', fontSize: '0.8em', borderRadius: 7, fontFamily: 'inherit', cursor: 'pointer',
                    background: predMonths === m ? 'var(--accent)' : 'transparent',
                    color:      predMonths === m ? 'var(--teal-900)' : 'var(--text-secondary)',
                    border:     predMonths === m ? 'none' : '1px solid var(--border)',
                    fontWeight: predMonths === m ? 700 : 500,
                  }}>{m}mo</button>
                ))
            }
          </div>
        </div>

        {loading ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875em' }}>
            Loading forecast…
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875em' }}>
              <Info size={32} style={{ marginBottom: 8 }} />
              <div>No data yet. Import transactions to generate a forecast.</div>
            </div>
          </div>
        ) : (() => {
          const light = isLight();
          const gridStroke  = light ? 'rgba(14,76,73,0.08)'  : 'rgba(255,227,180,0.07)';
          const axisStroke  = light ? 'rgba(14,76,73,0.15)'  : 'rgba(255,227,180,0.1)';
          const tickFill    = light ? 'rgba(14,76,73,0.55)'  : 'rgba(236,199,176,0.5)';
          const barFill     = light ? '#0e4c49'               : '#9ca3af';
          const bandFill    = light ? '#0e4c49'               : '#ffe3b4';
          const bandOpacity = light ? 0.1                     : 0.12;
          const lineStroke  = light ? '#0e4c49'               : '#ffd700';
          const dotFill     = light ? '#0e4c49'               : '#ffd700';
          const dotStroke   = light ? '#fff'                  : '#0d3533';
          const refStroke   = light ? 'rgba(14,76,73,0.25)'  : 'rgba(255,227,180,0.2)';
          const refLabel    = light ? 'rgba(14,76,73,0.5)'   : 'rgba(236,199,176,0.45)';
          return (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: tickFill, fontSize: 11 }}
                  axisLine={{ stroke: axisStroke }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: tickFill, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${(v / 1000).toFixed(1)}k`}
                  width={52}
                />
                <Tooltip content={<ForecastTooltip />} />

                {boundaryLabel && (
                  <ReferenceLine
                    x={boundaryLabel}
                    stroke={refStroke}
                    strokeDasharray="4 3"
                    label={{ value: 'Forecast →', fill: refLabel, fontSize: 11, position: 'insideTopRight' }}
                  />
                )}

                <Bar dataKey="actual" name="Actual" fill={barFill} radius={[3,3,0,0]} maxBarSize={40} />

                <Area
                  dataKey="lower"
                  stackId="band"
                  stroke="none"
                  fill="transparent"
                  legendType="none"
                  activeDot={false}
                />
                <Area
                  dataKey="bandWidth"
                  stackId="band"
                  name="Confidence band"
                  stroke="none"
                  fill={bandFill}
                  fillOpacity={bandOpacity}
                  activeDot={false}
                />

                <Line
                  dataKey="median"
                  name="Forecast median"
                  stroke={lineStroke}
                  strokeWidth={2.5}
                  strokeDasharray="6 3"
                  dot={{ r: 4, fill: dotFill, stroke: dotStroke, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          );
        })()}
      </Card>

      {/* ── Graduation Forecast Card ── */}
      {gradForecast && gradMonths > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <GraduationCap size={24} color="var(--accent)" />
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95em' }}>Graduation Forecast</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75em', opacity: 0.6 }}>
                Through {gradForecast.graduation_date} · {gradMonths} month{gradMonths !== 1 ? 's' : ''} remaining
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--text-primary)', fontSize: '1.55em', fontWeight: 700, letterSpacing: '-0.4px' }}>{usd(gradTotal)}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75em', opacity: 0.55 }}>total projected spend</div>
            </div>
          </div>
          {gradForecast.warnings?.length > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', borderRadius: 6, color: '#f59e0b', fontSize: '0.78em' }}>
              {gradForecast.warnings[0]}
            </div>
          )}
        </Card>
      )}

      {/* ── Historical table (weekly or monthly) ── */}
      {granularity === 'weekly' && weeklySummary && weeklySummary.length > 0 && (
        <Card>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95em', marginBottom: 16 }}>
            Weekly Spending History
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875em' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.6 }}>Week</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.6 }}>Dates</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.6 }}>Total Spent</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.6 }}>vs. Avg</th>
                  <th style={{ padding: '8px 10px' }}></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const avg = weeklySummary.reduce((s, w) => s + w.total, 0) / weeklySummary.length;
                  const maxT = Math.max(...weeklySummary.map(w => w.total));
                  return [...weeklySummary].reverse().map((w, i) => {
                    const pct = avg > 0 ? ((w.total - avg) / avg) * 100 : 0;
                    const barW = Math.min(Math.abs(w.total / maxT) * 100, 100);
                    const fmtDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '9px 10px', color: 'var(--text-primary)' }}>{weekLabel(w.year, w.week)}</td>
                        <td style={{ padding: '9px 10px', color: 'var(--text-secondary)', fontSize: '0.83em', opacity: 0.6 }}>
                          {fmtDate(w.week_start)} – {fmtDate(w.week_end)}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>{usd(w.total)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: '0.8em' }}>
                          <span style={{ color: pct > 0 ? '#f87171' : '#2dd4bf' }}>
                            {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: '9px 10px', width: 100 }}>
                          <div style={{ height: 5, background: 'rgba(255,227,180,0.08)', borderRadius: 99 }}>
                            <div style={{ height: '100%', width: `${barW}%`, background: 'var(--accent)', borderRadius: 99, opacity: 0.6 }} />
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Loan Repayment Chart ── */}
      {loanProjection && loanProjection.monthly_schedule.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95em' }}>Loan Repayment Projection</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75em', marginTop: 2, opacity: 0.6 }}>
                {loanProjection.months_remaining} months remaining · paid off by {loanProjection.payoff_date}
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={loanProjection.monthly_schedule.map(p => ({
              label: `${MONTH_NAMES[(p.month - 1) % 12]} '${String(p.year).slice(2)}`,
              remaining: p.remaining,
            }))} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,227,180,0.06)" />
              <XAxis dataKey="label" tick={{ fill: 'rgba(236,199,176,0.5)', fontSize: 10 }} tickLine={false} interval={Math.floor(loanProjection.monthly_schedule.length / 6)} />
              <YAxis tick={{ fill: 'rgba(236,199,176,0.5)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={48} />
              <Tooltip formatter={(v) => [`$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, 'Remaining']}
                contentStyle={{ background: '#0d3533', border: '1px solid rgba(255,227,180,0.1)', borderRadius: 8, fontSize: 12 }} />
              <Line dataKey="remaining" stroke="#f87171" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {granularity === 'monthly' && forecast && forecast.history.length > 0 && (
        <Card>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95em', marginBottom: 16 }}>
            Historical Monthly Spend
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875em' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.6 }}>Month</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.6 }}>Total Spent</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.6 }}>vs. Avg</th>
                  <th style={{ padding: '8px 10px' }}></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const avg = forecast.history.reduce((s, h) => s + h.total, 0) / forecast.history.length;
                  return [...forecast.history].reverse().map((h, i) => {
                    const pct = avg > 0 ? ((h.total - avg) / avg) * 100 : 0;
                    const barW = Math.min(Math.abs(h.total / Math.max(...forecast.history.map(x => x.total))) * 100, 100);
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '9px 10px', color: 'var(--text-primary)' }}>
                          {monthLabel(h.year, h.month ?? 1)}
                          {h.synthetic && <span style={{ color: 'var(--text-muted)', fontSize: '0.78em', marginLeft: 6 }}>(estimated)</span>}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>{usd(h.total)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: '0.8em' }}>
                          <span style={{ color: pct > 0 ? '#f87171' : '#2dd4bf' }}>
                            {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: '9px 10px', width: 100 }}>
                          <div style={{ height: 5, background: 'rgba(255,227,180,0.08)', borderRadius: 99 }}>
                            <div style={{ height: '100%', width: `${barW}%`, background: 'var(--accent)', borderRadius: 99, opacity: 0.6 }} />
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
