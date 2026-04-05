/**
 * Reports — Chronos-2 spending forecast with confidence bands + historical breakdown.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, Bar, Area, Line,
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
function ForecastTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as ChartPoint;
  return (
    <div style={{
      background: '#1a0505', border: '1px solid #7a0000',
      borderRadius: 8, padding: '10px 14px', fontSize: 13,
    }}>
      <div style={{ color: '#FFD700', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {d.actual != null && (
        <div style={{ color: '#FFE4E1' }}>Actual: <b>{usd(d.actual)}</b></div>
      )}
      {d.median != null && (
        <>
          <div style={{ color: '#FFD700' }}>Forecast: <b>{usd(d.median)}</b></div>
          {d.lower != null && d.bandWidth != null && (
            <div style={{ color: '#aaa', fontSize: 11 }}>
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
    <div style={{
      background: 'rgba(26, 5, 5, 0.8)',
      border: '1px solid #7a0000',
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
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <TrendingUp size={28} color="#FFD700" />
        <div>
          <h2 style={{ color: '#FFE4E1', margin: 0 }}>Spending Reports & Forecast</h2>
          <p style={{ color: '#aaa', fontSize: 13, margin: 0 }}>
            Powered by Amazon Chronos-2 · historical actuals + probabilistic predictions
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Weekly / Monthly toggle */}
          {(['weekly', 'monthly'] as const).map(g => (
            <button key={g} onClick={() => setGranularity(g)} style={{
              padding: '5px 14px', fontSize: 13, borderRadius: 4,
              background: granularity === g ? '#FFD700' : 'transparent',
              color:      granularity === g ? '#550000' : '#FFE4E1',
              border:     granularity === g ? 'none' : '1px solid #7a0000',
              fontWeight: granularity === g ? 700 : 400, cursor: 'pointer',
            }}>
              {g === 'weekly' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
          <button
            onClick={() => fetchForecast()}
            style={{ background: 'transparent', border: '1px solid #7a0000', color: '#FFE4E1', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Warning banners ── */}
      {forecast?.warnings?.map((w, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'rgba(251, 191, 36, 0.1)', border: '1px solid #fbbf24',
          borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#fbbf24',
        }}>
          <AlertTriangle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
          {w}
        </div>
      ))}

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444',
          borderRadius: 8, padding: '10px 14px', color: '#f87171', marginBottom: 16, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {/* ── Summary cards ── */}
      {forecast && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <Card>
            <div style={{ color: '#aaa', fontSize: 12, marginBottom: 4 }}>
              TOTAL PROJECTED ({granularity === 'weekly' ? `${predWeeks}wk` : `${predMonths}mo`})
            </div>
            <div style={{ color: '#FFD700', fontSize: 24, fontWeight: 700 }}>{usd(totalProjected)}</div>
          </Card>
          <Card>
            <div style={{ color: '#aaa', fontSize: 12, marginBottom: 4 }}>
              {granularity === 'weekly' ? 'AVG / WEEK' : 'AVG / MONTH'}
            </div>
            <div style={{ color: '#FFD700', fontSize: 24, fontWeight: 700 }}>{usd(avgProjected)}</div>
          </Card>
          <Card>
            <div style={{ color: '#aaa', fontSize: 12, marginBottom: 4 }}>
              {granularity === 'weekly' ? 'PEAK FORECAST WEEK' : 'PEAK FORECAST MONTH'}
            </div>
            <div style={{ color: '#FFD700', fontSize: 24, fontWeight: 700 }}>
              {peakPeriod
                ? (granularity === 'weekly' && peakPeriod.week != null
                    ? weekLabel(peakPeriod.year, peakPeriod.week)
                    : monthLabel(peakPeriod.year, peakPeriod.month ?? 1))
                : '—'}
            </div>
            {peakPeriod && (
              <div style={{ color: '#FFE4E1', fontSize: 12 }}>{usd(peakPeriod.median)}</div>
            )}
          </Card>
        </div>
      )}

      {/* ── Main Forecast Chart ── */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ color: '#FFE4E1', fontWeight: 600, fontSize: 15 }}>
              {granularity === 'weekly' ? 'Weekly' : 'Monthly'} Spending — History & Forecast
            </div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
              Gray bars = actual · Gold line = forecast median · Shaded band = confidence interval
            </div>
          </div>
          {/* Period selector */}
          <div style={{ display: 'flex', gap: 6 }}>
            {granularity === 'weekly'
              ? [4, 8, 12, 26].map(w => (
                  <button key={w} onClick={() => setPredWeeks(w)} style={{
                    padding: '5px 12px', fontSize: 13,
                    background: predWeeks === w ? '#FFD700' : 'transparent',
                    color:      predWeeks === w ? '#550000' : '#FFE4E1',
                    border:     predWeeks === w ? 'none' : '1px solid #7a0000',
                  }}>{w}wk</button>
                ))
              : [3, 6, 12].map(m => (
                  <button key={m} onClick={() => setPredMonths(m)} style={{
                    padding: '5px 14px', fontSize: 13,
                    background: predMonths === m ? '#FFD700' : 'transparent',
                    color:      predMonths === m ? '#550000' : '#FFE4E1',
                    border:     predMonths === m ? 'none' : '1px solid #7a0000',
                  }}>{m}mo</button>
                ))
            }
          </div>
        </div>

        {loading ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
            Loading forecast…
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#888' }}>
              <Info size={32} style={{ marginBottom: 8 }} />
              <div>No data yet. Import transactions to generate a forecast.</div>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#aaa', fontSize: 11 }}
                axisLine={{ stroke: '#7a0000' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#aaa', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(1)}k`}
                width={52}
              />
              <Tooltip content={<ForecastTooltip />} />

              {/* Reference line marking start of forecast */}
              {boundaryLabel && (
                <ReferenceLine
                  x={boundaryLabel}
                  stroke="#7a0000"
                  strokeDasharray="4 3"
                  label={{ value: 'Forecast →', fill: '#888', fontSize: 11, position: 'insideTopRight' }}
                />
              )}

              {/* Historical bars */}
              <Bar dataKey="actual" name="Actual" fill="#9ca3af" radius={[3,3,0,0]} maxBarSize={40} />

              {/* Confidence band — stacked areas: transparent base (lower) + visible band (upper-lower) */}
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
                fill="#FFD700"
                fillOpacity={0.15}
                activeDot={false}
              />

              {/* Forecast median line */}
              <Line
                dataKey="median"
                name="Forecast median"
                stroke="#FFD700"
                strokeWidth={2.5}
                strokeDasharray="6 3"
                dot={{ r: 4, fill: '#FFD700', stroke: '#550000', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── Graduation Forecast Card ── */}
      {gradForecast && gradMonths > 0 && (
        <Card style={{ marginBottom: 24, borderColor: '#DAA520' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <GraduationCap size={28} color="#FFD700" />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#FFE4E1', fontWeight: 600, fontSize: 15 }}>Graduation Forecast</div>
              <div style={{ color: '#888', fontSize: 12 }}>
                Through {gradForecast.graduation_date} · {gradMonths} month{gradMonths !== 1 ? 's' : ''} remaining
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#FFD700', fontSize: 28, fontWeight: 700 }}>{usd(gradTotal)}</div>
              <div style={{ color: '#aaa', fontSize: 12 }}>total projected spend</div>
            </div>
          </div>
          {gradForecast.warnings?.length > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(251,191,36,0.08)', borderRadius: 6, color: '#fbbf24', fontSize: 12 }}>
              {gradForecast.warnings[0]}
            </div>
          )}
        </Card>
      )}

      {/* ── Historical table (weekly or monthly) ── */}
      {granularity === 'weekly' && weeklySummary && weeklySummary.length > 0 && (
        <Card>
          <div style={{ color: '#FFE4E1', fontWeight: 600, fontSize: 15, marginBottom: 16 }}>
            Weekly Spending History
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #7a0000' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 500 }}>Week</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 500 }}>Dates</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: '#888', fontWeight: 500 }}>Total Spent</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: '#888', fontWeight: 500 }}>vs. Avg</th>
                  <th style={{ padding: '8px 12px' }}></th>
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
                      <tr key={i} style={{ borderBottom: '1px solid rgba(122,0,0,0.3)' }}>
                        <td style={{ padding: '10px 12px', color: '#FFE4E1' }}>{weekLabel(w.year, w.week)}</td>
                        <td style={{ padding: '10px 12px', color: '#aaa', fontSize: 12 }}>
                          {fmtDate(w.week_start)} – {fmtDate(w.week_end)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#FFD700', fontWeight: 600 }}>{usd(w.total)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12 }}>
                          <span style={{ color: pct > 0 ? '#f87171' : '#4ade80' }}>
                            {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', width: 120 }}>
                          <div style={{ height: 6, background: '#2d0a0a', borderRadius: 3 }}>
                            <div style={{ height: '100%', width: `${barW}%`, background: '#FFD700', borderRadius: 3, opacity: 0.7 }} />
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

      {granularity === 'monthly' && forecast && forecast.history.length > 0 && (
        <Card>
          <div style={{ color: '#FFE4E1', fontWeight: 600, fontSize: 15, marginBottom: 16 }}>
            Historical Monthly Spend
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #7a0000' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 500 }}>Month</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: '#888', fontWeight: 500 }}>Total Spent</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: '#888', fontWeight: 500 }}>vs. Avg</th>
                  <th style={{ padding: '8px 12px' }}></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const avg = forecast.history.reduce((s, h) => s + h.total, 0) / forecast.history.length;
                  return [...forecast.history].reverse().map((h, i) => {
                    const pct = avg > 0 ? ((h.total - avg) / avg) * 100 : 0;
                    const barW = Math.min(Math.abs(h.total / Math.max(...forecast.history.map(x => x.total))) * 100, 100);
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(122,0,0,0.3)' }}>
                        <td style={{ padding: '10px 12px', color: '#FFE4E1' }}>
                          {monthLabel(h.year, h.month ?? 1)}
                          {h.synthetic && <span style={{ color: '#888', fontSize: 11, marginLeft: 6 }}>(estimated)</span>}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#FFD700', fontWeight: 600 }}>{usd(h.total)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12 }}>
                          <span style={{ color: pct > 0 ? '#f87171' : '#4ade80' }}>
                            {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', width: 120 }}>
                          <div style={{ height: 6, background: '#2d0a0a', borderRadius: 3 }}>
                            <div style={{ height: '100%', width: `${barW}%`, background: '#FFD700', borderRadius: 3, opacity: 0.7 }} />
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
