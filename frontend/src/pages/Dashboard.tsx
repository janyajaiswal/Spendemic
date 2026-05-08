/**
 * Dashboard — multi-tab overview for international students.
 *
 * Tabs:
 *  0  Overview      — app feature cards + quick links (fill in your own copy)
 *  1  Financial Health — live income/expense summary + budget status
 *  2  Visa & Work   — work-hours tracker + visa rule pointers (fill in copy)
 *  3  Resources     — curated links/tips for int'l students (fill in copy)
 */
import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import '../styles/dashboard.css';

import { API } from '../lib/api';
import InfoTooltip from '../components/InfoTooltip';

// ─────────────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'health',    label: 'Financial Health' },
  { id: 'visa',      label: 'Visa & Work' },
  { id: 'resources', label: 'Resources' },
];


// ─────────────────────────────────────────────────────
// Visa & Work tab — work-hours tracker + rule pointers
// Fill in the rule text under each visa type.
// ─────────────────────────────────────────────────────
const VISA_RULES: { visa: string; rules: string[] }[] = [
  {
    visa: 'F-1 (Academic)',
    rules: [
      'On-campus work: up to 20 hrs/week during the academic semester; unlimited during official school breaks.',
      'Off-campus work requires authorization — Curricular Practical Training (CPT) is tied to a course; Optional Practical Training (OPT) is applied for separately through USCIS.',
      'Exceeding 20 hrs/week during the semester is a status violation that can trigger deportation proceedings. Track hours carefully.',
      'Summer: if enrolled full-time in the next semester, you may work on-campus full-time (40 hrs/week) during summer break.',
    ],
  },
  {
    visa: 'J-1 (Exchange Visitor)',
    rules: [
      'On-campus work: up to 20 hrs/week while school is in session; full-time during official breaks.',
      'Off-campus work requires written authorization from your Responsible Officer (RO) and is limited to economic necessity or as a component of your exchange program.',
      'Academic Training (AT) allows practical training directly related to your field of study for up to 18 months (or program length, whichever is shorter).',
    ],
  },
  {
    visa: 'Other / Not sure',
    rules: [
      'Contact your Designated School Official (DSO) or International Student Services (ISSS) office before working — unauthorized work can void your visa status.',
      'USCIS maintains the official work authorization guide at uscis.gov — search "students and exchange visitors" for your visa category.',
    ],
  },
];

function buildResourceSections(university: string) {
  const uniSearch = (q: string) =>
    `https://www.google.com/search?q=${encodeURIComponent((university ? university + ' ' : '') + q)}`;

  return [
    {
      title: 'Banking & Finances',
      items: [
        { label: 'Open a US bank account as an international student', detail: 'Most banks require a passport, I-20/DS-2019, and an SSN or ITIN. Chase, Bank of America, and local credit unions are popular choices for international students.', href: 'https://www.bankofamerica.com/student-banking/' },
        { label: 'Build US credit without a credit history', detail: 'Secured credit cards (Discover it Secured, Capital One) and credit-builder loans let you establish a credit score. Aim for a score above 700 before graduation.', href: 'https://www.discover.com/credit-cards/secured/' },
        { label: 'Send money home cheaply (Wise, Remitly)', detail: 'Wise offers mid-market exchange rates with transparent fees — typically 5–10× cheaper than a bank wire. Remitly is fast for urgent transfers.', href: 'https://wise.com/' },
      ],
    },
    {
      title: 'Scholarships & Aid',
      items: [
        {
          label: `${university ? university + ' I' : 'I'}nternational Student Scholarships`,
          detail: university
            ? `Search your school's scholarship portal for merit-based awards open to F-1/J-1 students.`
            : 'Search your university\'s scholarship portal for merit-based awards open to F-1/J-1 students.',
          href: uniSearch('international student scholarships'),
        },
        { label: 'CalFresh (food assistance) for eligible students', detail: 'Some international students with certain immigration statuses are eligible. Contact your campus Student Wellness Center for a screener.', href: 'https://www.cdss.ca.gov/calfresh' },
        {
          label: `${university ? university + ' ' : ''}ISSS Emergency Fund`,
          detail: 'International Student Services offices often offer emergency micro-grants for students facing unexpected financial hardship. Check with your school\'s ISSS office.',
          href: uniSearch('ISSS emergency fund international students'),
        },
      ],
    },
    {
      title: 'Tax & Legal',
      items: [
        { label: 'ITIN vs SSN — which do you need?', detail: 'F-1/J-1 students without work authorization need an ITIN (W-7 form) to file taxes. Students with CPT/OPT can apply for an SSN.', href: 'https://www.irs.gov/individuals/individual-taxpayer-identification-number' },
        { label: 'Filing US taxes as an F-1 or J-1 student (Sprintax)', detail: 'International students are non-resident aliens for tax purposes (first 5 years on F-1). Sprintax is the IRS-endorsed software for non-resident tax returns.', href: 'https://www.sprintax.com/' },
        { label: 'US tax treaty benefits by country', detail: 'Many countries have treaties with the US that reduce or eliminate withholding tax on scholarships and stipends. Check IRS Publication 901.', href: 'https://www.irs.gov/individuals/international-taxpayers/tax-treaty-tables' },
      ],
    },
    {
      title: 'Health & Insurance',
      items: [
        {
          label: `${university ? university + ' S' : 'S'}tudent Health Insurance (SHIP)`,
          detail: university
            ? `${university} may require health insurance coverage. Search your school's student health portal for plan details and enrollment.`
            : 'Most US universities require health insurance. Check your university\'s student health portal for coverage options.',
          href: uniSearch('student health insurance SHIP'),
        },
        { label: 'Medi-Cal eligibility for students', detail: 'Certain visa holders (including DACA, certain humanitarian statuses) may qualify for low-cost Medi-Cal coverage. Check Covered California for income-based options.', href: 'https://www.coveredca.com/' },
      ],
    },
  ];
}

// ─────────────────────────────────────────────────────
// Types for financial health data
// ─────────────────────────────────────────────────────
interface RawTx {
  amount: string; currency: string; type: string; category: string;
  transaction_date: string;
}
interface ComputedSummary {
  total_income: number;
  total_expenses: number;
  net: number;
  by_category: Record<string, number>;
  workingCurrency: string;
}
interface Budget {
  id: string; category: string; limit_amount: string;
  currency: string; spent: string; utilization: number; period: string;
}

/** Convert `amount` in `fromCurrency` to `toCurrency` using rates relative to a shared base. */
function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  if (from === to) return amount;
  const rFrom = rates[from] ?? 1;
  const rTo = rates[to] ?? 1;
  return (amount / rFrom) * rTo;
}


// ─────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────
interface RecentTx {
  id: string; amount: string; currency: string; type: string;
  category: string; description: string; transaction_date: string;
}
interface ActiveJob {
  id: string; job_name: string; employer?: string;
  hourly_rate: number; hours_per_week: number; job_type?: string;
}
interface Shift { hours: number; date: string; }

function getWeekKey(d: Date): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}
function getWeekRange(d: Date): string {
  const day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(mon)} – ${fmt(sun)}`;
}
function loadShifts(): Record<string, Record<string, Shift[]>> {
  try { return JSON.parse(localStorage.getItem('spendemic_shifts') ?? '{}'); } catch { return {}; }
}
function saveShifts(data: Record<string, Record<string, Shift[]>>) {
  localStorage.setItem('spendemic_shifts', JSON.stringify(data));
}

function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (rafRef.current) clearInterval(rafRef.current);
    if (!target || target <= 0) { setVal(target); return; }
    let current = 0;
    const step = target / (duration / 16);
    rafRef.current = setInterval(() => {
      current += step;
      if (current >= target) { setVal(target); clearInterval(rafRef.current!); }
      else setVal(Math.round(current));
    }, 16);
    return () => { if (rafRef.current) clearInterval(rafRef.current); };
  }, [target, duration]);
  return val;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get('tab');
    return ['overview', 'health', 'visa', 'resources'].includes(t ?? '') ? t! : 'overview';
  });
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<ComputedSummary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Animated counters for stat cards
  const animatedIncome   = useCountUp(summary?.total_income ?? 0);
  const animatedExpenses = useCountUp(summary?.total_expenses ?? 0);
  const animatedNet      = useCountUp(Math.abs(summary?.net ?? 0));
  const [cashflow, setCashflow] = useState<{ month: string; income: number; expenses: number }[]>([]);
  const [recentTxs, setRecentTxs] = useState<RecentTx[]>([]);
  const [university, setUniversity] = useState('');

  // Visa & Work tracker state
  const [visaType, setVisaType] = useState(() => localStorage.getItem('visa_type') ?? 'F-1 (Academic)');
  const hoursCap = 20;
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [shiftHours, setShiftHours] = useState('');
  const [allShifts, setAllShifts] = useState<Record<string, Record<string, Shift[]>>>(loadShifts);
  const today = new Date();
  const weekKey = getWeekKey(today);
  const weekShifts = allShifts[weekKey] ?? {};  // { jobId: Shift[] }

  // Sync tab when chatbot navigates to /dashboard?tab=...
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && ['overview', 'health', 'visa', 'resources'].includes(t)) setActiveTab(t);
  }, [searchParams]);

  useEffect(() => { localStorage.setItem('visa_type', visaType); }, [visaType]);

  useEffect(() => {
    if (activeTab !== 'visa') return;
    const token = user?.accessToken ?? localStorage.getItem('spendemic_token') ?? '';
    if (!token) return;
    fetch(`${API}/jobs`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((jobs: ActiveJob[]) => {
        setActiveJobs(jobs);
        if (jobs.length > 0 && !selectedJobId) setSelectedJobId(jobs[0].id);
      })
      .catch(() => {});
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab !== 'health' && activeTab !== 'overview') return;
    const token = user?.accessToken ?? localStorage.getItem('spendemic_token') ?? '';
    if (!token) return;
    setSummary(null);
    setLoadingHealth(true);
    const today = new Date();
    const authHdr = { Authorization: `Bearer ${token}` };

    (async () => {
      try {
        // 1. Get user's working currency + university
        const profileRes = await fetch(`${API}/users/me`, { headers: authHdr });
        const profileData = profileRes.ok ? await profileRes.json() : null;
        const workingCurrency: string = profileData?.study_country_currency ?? 'USD';
        if (profileData?.university) setUniversity(profileData.university);

        // 2. Load exchange rates (no auth needed)
        const ratesRes = await fetch(`${API}/exchange-rates/${workingCurrency}`);
        const rates: Record<string, number> = ratesRes.ok
          ? (await ratesRes.json()).rates ?? {}
          : {};
        rates[workingCurrency] = rates[workingCurrency] ?? 1;

        // 3. Fetch this month's transactions (max 200 — backend limit)
        const txUrl = `${API}/transactions?year=${today.getFullYear()}&month=${today.getMonth() + 1}&limit=200`;
        const txRes = await fetch(txUrl, { headers: authHdr });
        const txList: RawTx[] = txRes.ok ? await txRes.json() : [];

        // 4. Compute converted totals
        let totalIncome = 0, totalExpenses = 0;
        const byCategory: Record<string, number> = {};
        for (const tx of txList) {
          const amt = convert(Number(tx.amount), tx.currency, workingCurrency, rates);
          if (tx.type === 'INCOME') totalIncome += amt;
          else totalExpenses += amt;
          byCategory[tx.category] = (byCategory[tx.category] ?? 0) + amt;
        }

        setSummary({
          total_income: totalIncome,
          total_expenses: totalExpenses,
          net: totalIncome - totalExpenses,
          by_category: byCategory,
          workingCurrency,
        });

        // 5. Load budgets
        const bRes = await fetch(`${API}/budgets?active_only=true`, { headers: authHdr });
        if (bRes.ok) setBudgets(await bRes.json());

        // 6. Build 6-month cashflow
        const months: { month: string; income: number; expenses: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const y = d.getFullYear();
          const m = d.getMonth() + 1;
          const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
          try {
            const r = await fetch(`${API}/transactions?year=${y}&month=${m}&limit=200`, { headers: authHdr });
            const txs: RawTx[] = r.ok ? await r.json() : [];
            let inc = 0, exp = 0;
            for (const tx of txs) {
              const amt = convert(Number(tx.amount), tx.currency, workingCurrency, rates);
              if (tx.type === 'INCOME') inc += amt; else exp += amt;
            }
            months.push({ month: label, income: Math.round(inc * 100) / 100, expenses: Math.round(exp * 100) / 100 });
          } catch { months.push({ month: label, income: 0, expenses: 0 }); }
        }
        setCashflow(months);

        // 7. Fetch recent transactions for overview tab
        const recentRes = await fetch(`${API}/transactions?limit=5`, { headers: authHdr });
        if (recentRes.ok) setRecentTxs(await recentRes.json());
      } finally {
        setLoadingHealth(false);
      }
    })();
  }, [activeTab, user]);

  const addShift = () => {
    const hrs = parseFloat(shiftHours);
    if (!selectedJobId || isNaN(hrs) || hrs <= 0) return;
    const todayStr = today.toISOString().split('T')[0];
    const newShift: Shift = { hours: hrs, date: todayStr };
    const updated = { ...allShifts };
    if (!updated[weekKey]) updated[weekKey] = {};
    if (!updated[weekKey][selectedJobId]) updated[weekKey][selectedJobId] = [];
    updated[weekKey][selectedJobId] = [...updated[weekKey][selectedJobId], newShift];
    setAllShifts(updated);
    saveShifts(updated);
    setShiftHours('');
  };

  const removeShift = (jobId: string, idx: number) => {
    const updated = { ...allShifts };
    updated[weekKey][jobId] = updated[weekKey][jobId].filter((_, i) => i !== idx);
    setAllShifts(updated);
    saveShifts(updated);
  };

  const totalWeekHours = Object.values(weekShifts).flat().reduce((s, sh) => s + sh.hours, 0);
  const weekEarnings = activeJobs.reduce((sum, job) => {
    const jobHrs = (weekShifts[job.id] ?? []).reduce((s, sh) => s + sh.hours, 0);
    return sum + jobHrs * Number(job.hourly_rate);
  }, 0);

  const q = search.toLowerCase();

  return (
    <div style={s.page}>
      {/* Top bar: title + search */}
      <div style={s.topBar}>
        <div>
          <h1 style={s.title}>Dashboard</h1>
          <p style={s.subtitle}>Your financial hub — everything in one place</p>
        </div>
        <div style={s.searchBox}>
          <input
            style={s.searchInput}
            placeholder="Search resources and tips…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button style={s.searchClear} onClick={() => setSearch('')}>✕</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabBar}>
        {TABS.map(t => (
          <button key={t.id} style={{ ...s.tab, ...(activeTab === t.id ? s.tabActive : {}) }}
            onClick={() => { setActiveTab(t.id); setSearch(''); }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="tab-slide-in">
          {loadingHealth ? (
            <p style={s.loading}>Loading your snapshot…</p>
          ) : (
            <>
              {/* Greeting + quick stats */}
              <div className="dash-hero">
                <div style={s.overviewGreeting}>
                  <div>
                    <h2 style={s.greetTitle}>
                      {user?.name ? `Hi, ${user.name.split(' ')[0]} 👋` : 'Welcome back 👋'}
                    </h2>
                    <p style={s.greetSub}>
                      {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} snapshot
                    </p>
                  </div>
                  <div style={s.quickActions}>
                    <Link to="/transactions" style={s.qaBtn}>+ Add Transaction</Link>
                    <Link to="/reports" style={{ ...s.qaBtn, background: 'rgba(255,215,0,0.08)', borderColor: 'rgba(255,215,0,0.25)', color: 'var(--highlight)' }}>View Forecast →</Link>
                  </div>
                </div>
              </div>

              {/* Stats strip */}
              {summary ? (
                <div style={s.healthStrip}>
                  {[
                    { label: 'Income this month', value: animatedIncome, raw: summary.total_income, color: '#2dd4bf', icon: '💵' },
                    { label: 'Spent this month', value: animatedExpenses, raw: summary.total_expenses, color: '#f59e0b', icon: '🛍️' },
                    { label: 'Net savings', value: animatedNet, raw: summary.net, color: summary.net >= 0 ? '#2dd4bf' : '#f87171', icon: summary.net >= 0 ? '🏦' : '📉' },
                  ].map((c, i) => (
                    <div key={c.label} className="dash-card stagger-in" style={{ ...s.healthCard, '--i': i } as React.CSSProperties}>
                      <div className="dash-stat-bg-icon">{c.icon}</div>
                      <span style={s.healthLabel}>{c.label}</span>
                      <span style={{ ...s.healthValue, color: c.color }}>
                        {summary.workingCurrency} {c.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        {c.label === 'Net savings' && c.raw < 0 && <span style={{ fontSize: '0.6em', opacity: 0.7 }}> deficit</span>}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ ...s.healthStrip }}>
                  {['Income this month', 'Spent this month', 'Net savings'].map(l => (
                    <div key={l} className="dash-card" style={{ ...s.healthCard, opacity: 0.4 }}>
                      <span style={s.healthLabel}>{l}</span>
                      <span style={{ ...s.healthValue, color: 'var(--text-secondary)' }}>—</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Budget health strip */}
              {budgets.length > 0 && (
                <>
                  <h3 style={s.sectionTitle}>Budget health</h3>
                  <div style={s.budgetList}>
                    {budgets.slice(0, 4).map(b => {
                      const pct = Math.min(b.utilization, 1);
                      const color = b.utilization >= 1 ? '#f87171' : b.utilization >= 0.8 ? '#fbbf24' : '#2dd4bf';
                      return (
                        <div key={b.id} style={s.budgetRow}>
                          <span style={s.budgetCat}>{b.category.replace(/_/g, ' ')}</span>
                          <div style={s.budgetBar}>
                            <div style={{ ...s.budgetBarFill, width: `${pct * 100}%`, background: color }} />
                          </div>
                          <span style={{ ...s.budgetPct, color }}>{Math.round(b.utilization * 100)}%</span>
                          <span style={s.budgetAmt}>{b.currency} {Number(b.spent).toFixed(0)} / {Number(b.limit_amount).toFixed(0)}</span>
                        </div>
                      );
                    })}
                  </div>
                  {budgets.length > 4 && (
                    <Link to="/budgets" style={s.seeAll}>+ {budgets.length - 4} more budgets →</Link>
                  )}
                </>
              )}

              {/* Recent activity */}
              {recentTxs.length > 0 && (
                <>
                  <h3 style={s.sectionTitle}>Recent activity</h3>
                  <div className="dash-card" style={{ borderRadius: 12, overflow: 'hidden' }}>
                    {recentTxs.map((tx, i) => (
                      <div key={tx.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 18px',
                        borderBottom: i < recentTxs.length - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: '0.875em', color: 'var(--text-primary)', fontWeight: 500 }}>{tx.description || tx.category.replace(/_/g, ' ')}</span>
                          <span style={{ fontSize: '0.72em', color: 'var(--text-secondary)', opacity: 0.55 }}>
                            {tx.category.replace(/_/g, ' ')} · {new Date(tx.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '0.95em', color: tx.type === 'INCOME' ? '#2dd4bf' : '#f59e0b' }}>
                          {tx.type === 'INCOME' ? '+' : '−'}{tx.currency} {Number(tx.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Link to="/transactions" style={s.seeAll}>See all transactions →</Link>
                </>
              )}

              {/* Empty state */}
              {!summary && recentTxs.length === 0 && budgets.length === 0 && (
                <div style={s.emptyHint}>
                  <p style={{ marginBottom: 12 }}>No data yet — add your first transaction to get started.</p>
                  <Link to="/transactions" style={s.seeAll}>Add Transaction →</Link>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB: FINANCIAL HEALTH ── */}
      {activeTab === 'health' && (
        <div className="tab-slide-in">
          {loadingHealth ? (
            <p style={s.loading}>Loading your data…</p>
          ) : (
            <>
              {/* Currency banner */}
              {summary && (
                <div style={s.currencyBanner}>
                  Amounts shown in <strong>{summary.workingCurrency}</strong>.
                  {' '}Not your currency?{' '}
                  <Link to="/settings" style={{ color: 'var(--accent)', fontWeight: 600 }}>Update in Settings →</Link>
                </div>
              )}
              {/* Monthly summary cards */}
              <h3 style={{ ...s.sectionTitle, display: 'flex', alignItems: 'center' }}>
                This month at a glance
                <InfoTooltip
                  text="Shows your income, expenses, and net savings for the current calendar month based on your logged transactions. Add transactions in the Transactions page to keep this up to date."
                  position="right"
                  maxWidth={320}
                />
              </h3>
              <div style={s.healthStrip}>
                {[
                  { label: 'Income', value: summary?.total_income ?? 0, color: '#4ade80' },
                  { label: 'Expenses', value: summary?.total_expenses ?? 0, color: '#f87171' },
                  { label: 'Net Savings', value: summary?.net ?? 0, color: (summary?.net ?? 0) >= 0 ? '#4ade80' : '#f87171' },
                ].map(c => (
                  <div key={c.label} className="dash-card" style={s.healthCard}>
                    <span style={s.healthLabel}>{c.label}</span>
                    <span style={{ ...s.healthValue, color: c.color }}>
                      {summary?.workingCurrency ?? 'USD'}{' '}
                      {Number(c.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>

              {/* Spending by category */}
              {summary?.by_category && Object.keys(summary.by_category).length > 0 && (
                <>
                  <h3 style={s.sectionTitle}>All activity by category ({summary.workingCurrency})</h3>
                  <div style={s.catGrid}>
                    {Object.entries(summary.by_category).map(([cat, amt]) => (
                      <div key={cat} className="dash-card" style={s.catCard}>
                        <span style={s.catName}>{cat.replace(/_/g, ' ')}</span>
                        <span style={s.catAmt}>{summary.workingCurrency} {Number(amt).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Budget status */}
              {budgets.length > 0 && (
                <>
                  <h3 style={{ ...s.sectionTitle, display: 'flex', alignItems: 'center' }}>
                    Budget status
                    <InfoTooltip
                      text={'Shows how much of each budget you\'ve used this month.\n• Green = under budget\n• Amber = approaching limit (80%+)\n• Red = exceeded\n\nSet and manage budgets in the Budgets page.'}
                      position="right"
                      maxWidth={320}
                    />
                  </h3>
                  <div style={s.budgetList}>
                    {budgets.map(b => {
                      const pct = Math.min(b.utilization, 1);
                      const color = b.utilization >= 1 ? '#f87171' : b.utilization >= 0.8 ? '#fbbf24' : '#4ade80';
                      return (
                        <div key={b.id} style={s.budgetRow}>
                          <span style={s.budgetCat}>{b.category.replace(/_/g, ' ')}</span>
                          <div style={s.budgetBar}>
                            <div style={{ ...s.budgetBarFill, width: `${pct * 100}%`, background: color }} />
                          </div>
                          <span style={{ ...s.budgetPct, color }}>
                            {Math.round(b.utilization * 100)}%
                          </span>
                          <span style={s.budgetAmt}>
                            {b.currency} {Number(b.spent).toFixed(0)} / {Number(b.limit_amount).toFixed(0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <Link to="/budgets" style={s.seeAll}>Manage all budgets →</Link>
                </>
              )}

              {cashflow.length > 0 && cashflow.some(m => m.income > 0 || m.expenses > 0) && (
                <>
                  <h3 style={{ ...s.sectionTitle, display: 'flex', alignItems: 'center' }}>
                    6-Month Cash Flow
                    <InfoTooltip
                      text="Compares your total income vs. total expenses for each of the last 6 months. Use this to spot months where you overspent or find trends in your spending."
                      position="right"
                      maxWidth={320}
                    />
                  </h3>
                  {(() => {
                    const light = document.documentElement.getAttribute('data-theme') === 'light';
                    return (
                      <div style={{ background: light ? 'rgba(14,76,73,0.03)' : 'rgba(255,227,180,0.03)', border: '1px solid rgba(255,215,0,0.1)', borderRadius: 12, padding: '16px 8px 8px' }}>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={cashflow} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={light ? 'rgba(14,76,73,0.08)' : 'rgba(255,227,180,0.06)'} />
                            <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `$${v}`} />
                            <Tooltip
                              contentStyle={{ background: light ? '#fff' : '#0d3533', border: `1px solid ${light ? 'rgba(14,76,73,0.15)' : 'rgba(255,227,180,0.1)'}`, borderRadius: 8, fontSize: 12 }}
                              labelStyle={{ color: light ? '#0e4c49' : '#ffe3b4', fontWeight: 600 }}
                              formatter={(v: unknown, name: unknown) => [`$${Number(v).toFixed(2)}`, String(name)]}
                            />
                            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                            <Bar dataKey="income" name="Income" fill="#2dd4bf" radius={[4,4,0,0]} />
                            <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}
                </>
              )}

              {summary && summary.total_income === 0 && summary.total_expenses === 0 && (
                <div style={s.emptyHint}>
                  <p>No transactions this month yet.</p>
                  <Link to="/transactions" style={s.seeAll}>Add your first transaction →</Link>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB: VISA & WORK ── */}
      {activeTab === 'visa' && (
        <div className="tab-slide-in">
          {/* ── Visa selector + compliance bar ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <h3 style={{ ...s.sectionTitle, margin: '0 0 4px' }}>
                Weekly work-hours tracker
                <InfoTooltip
                  text={'F-1/J-1 students: max 20 hrs/week on-campus during the semester. Full-time allowed during official school breaks.\n\nHours are saved per job, per week in your browser. They reset each new week automatically.'}
                  position="right"
                  maxWidth={340}
                />
              </h3>
              <p style={{ margin: 0, fontSize: '0.8em', color: 'var(--text-secondary)', opacity: 0.55 }}>
                Week of {getWeekRange(today)}
              </p>
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Visa type</label>
              <select style={{ ...s.input, minWidth: 180 }} value={visaType} onChange={e => setVisaType(e.target.value)}>
                {VISA_RULES.map(v => <option key={v.visa}>{v.visa}</option>)}
              </select>
            </div>
          </div>

          {/* Compliance bar */}
          <div className="dash-card" style={{ padding: '18px 20px', borderRadius: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: '1.05em', color: totalWeekHours > hoursCap ? '#f87171' : 'var(--text-primary)' }}>
                {totalWeekHours.toFixed(1)} / {hoursCap} hrs this week
              </span>
              {weekEarnings > 0 && (
                <span style={{ fontSize: '0.83em', color: '#2dd4bf', fontWeight: 600 }}>
                  ~${weekEarnings.toFixed(2)} earned
                </span>
              )}
            </div>
            <div style={s.hoursBarTrack}>
              <div style={{
                ...s.hoursBarFill,
                width: `${Math.min(totalWeekHours / hoursCap, 1) * 100}%`,
                background: totalWeekHours > hoursCap ? '#f87171' : totalWeekHours >= hoursCap * 0.8 ? '#fbbf24' : '#2dd4bf',
              }} />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.8em', fontWeight: 600, color: totalWeekHours > hoursCap ? '#f87171' : '#2dd4bf' }}>
              {totalWeekHours > hoursCap
                ? `${(totalWeekHours - hoursCap).toFixed(1)} hrs over the ${hoursCap}-hr limit — check compliance`
                : `${(hoursCap - totalWeekHours).toFixed(1)} hrs remaining`}
            </p>
          </div>

          {/* ── Log a shift ── */}
          <h3 style={s.sectionTitle}>Log a shift</h3>
          {activeJobs.length === 0 ? (
            <div className="dash-card" style={{ padding: '20px', borderRadius: 12, marginBottom: 20, textAlign: 'center' }}>
              <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', opacity: 0.65, fontSize: '0.875em' }}>
                No jobs found. Add your jobs in Settings first.
              </p>
              <Link to="/settings" style={s.seeAll}>Go to Settings → Jobs</Link>
            </div>
          ) : (
            <div className="dash-card" style={{ padding: '18px 20px', borderRadius: 12, marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'end' }}>
                <div style={s.formGroup}>
                  <label style={s.label}>Job</label>
                  <select style={s.input} value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}>
                    {activeJobs.map(j => (
                      <option key={j.id} value={j.id}>
                        {j.job_name}{j.employer ? ` — ${j.employer}` : ''} (${Number(j.hourly_rate).toFixed(2)}/hr)
                      </option>
                    ))}
                  </select>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Hours</label>
                  <input
                    style={{ ...s.input, width: 90 }}
                    type="number" min="0.5" max="24" step="0.5"
                    placeholder="e.g. 3.5"
                    value={shiftHours}
                    onChange={e => setShiftHours(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addShift()}
                  />
                </div>
                <button
                  onClick={addShift}
                  disabled={!shiftHours || parseFloat(shiftHours) <= 0}
                  style={{
                    padding: '10px 18px', background: '#2dd4bf', border: 'none', borderRadius: 8,
                    color: '#071e1c', fontWeight: 700, fontSize: '0.875em', cursor: 'pointer',
                    opacity: (!shiftHours || parseFloat(shiftHours) <= 0) ? 0.4 : 1,
                    alignSelf: 'end', height: 40,
                  }}
                >
                  + Log shift
                </button>
              </div>
            </div>
          )}

          {/* ── Per-job shift breakdown ── */}
          {activeJobs.length > 0 && (
            <>
              <h3 style={s.sectionTitle}>This week's shifts by job</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {activeJobs.map(job => {
                  const jobShifts = weekShifts[job.id] ?? [];
                  const jobHrs = jobShifts.reduce((s, sh) => s + sh.hours, 0);
                  const jobEarnings = jobHrs * Number(job.hourly_rate);
                  return (
                    <div key={job.id} className="dash-card" style={{ borderRadius: 12, overflow: 'hidden' }}>
                      {/* Job header */}
                      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: jobShifts.length > 0 ? '1px solid var(--border)' : 'none' }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '0.9em', color: 'var(--text-primary)' }}>{job.job_name}</span>
                          {job.employer && <span style={{ fontSize: '0.75em', color: 'var(--text-secondary)', opacity: 0.55, marginLeft: 8 }}>{job.employer}</span>}
                          <span style={{ fontSize: '0.72em', color: 'var(--text-secondary)', opacity: 0.45, marginLeft: 8 }}>${Number(job.hourly_rate).toFixed(2)}/hr</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, color: jobHrs > 0 ? '#2dd4bf' : 'var(--text-secondary)', fontSize: '0.9em' }}>
                            {jobHrs.toFixed(1)} hrs
                          </span>
                          {jobEarnings > 0 && (
                            <span style={{ fontSize: '0.75em', color: 'var(--text-secondary)', opacity: 0.6, marginLeft: 8 }}>
                              ${jobEarnings.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Shift list */}
                      {jobShifts.length === 0 ? (
                        <div style={{ padding: '10px 16px', fontSize: '0.78em', color: 'var(--text-secondary)', opacity: 0.4 }}>
                          No shifts logged yet this week
                        </div>
                      ) : (
                        jobShifts.map((sh, idx) => (
                          <div key={idx} style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx < jobShifts.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '0.83em' }}>
                            <span style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                              {new Date(sh.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sh.hours.toFixed(1)} hrs</span>
                              <button
                                onClick={() => removeShift(job.id, idx)}
                                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.85em', opacity: 0.6, padding: '2px 4px' }}
                                title="Remove shift"
                              >✕</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Visa rules */}
          <h3 style={s.sectionTitle}>Work authorization rules</h3>
          <div style={s.visaRulesGrid}>
            {VISA_RULES.map(v => (
              <div key={v.visa} className="dash-card" style={s.visaCard}>
                <h4 style={s.visaCardTitle}>{v.visa}</h4>
                <ul style={s.visaRuleList}>
                  {v.rules.map((r, i) => <li key={i} style={s.visaRuleItem}>{r}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: RESOURCES ── */}
      {activeTab === 'resources' && (
        <div className="tab-slide-in">
          <p style={s.resourcesIntro}>
            Curated guides and links for international students navigating finances in the US.
            {university && <span> Links are tailored for <strong>{university}</strong> — update your university in <Link to="/settings" style={{ color: 'var(--accent)' }}>Settings</Link> to see your school's resources.</span>}
          </p>
          {buildResourceSections(university)
            .filter(sec => !q || sec.title.toLowerCase().includes(q)
              || sec.items.some(i => i.label.toLowerCase().includes(q)))
            .map(sec => (
              <div key={sec.title} style={s.resSection}>
                <h3 style={s.resSectionTitle}>{sec.title}</h3>
                <div style={s.resGrid}>
                  {sec.items
                    .filter(i => !q || i.label.toLowerCase().includes(q))
                    .map((item, idx) => (
                      <div key={idx} className="dash-card" style={s.resCard}>
                        {item.href
                          ? <a href={item.href} target="_blank" rel="noopener noreferrer" style={{ ...s.resLabel, color: 'var(--accent)', textDecoration: 'none' }}>{item.label} ↗</a>
                          : <p style={s.resLabel}>{item.label}</p>
                        }
                        <p style={s.resDetail}>{item.detail}</p>
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px 36px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' },
  title: { fontSize: '1.5em', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px', margin: 0 },
  subtitle: { fontSize: '0.875em', color: 'var(--text-secondary)', opacity: 0.65, margin: '4px 0 0' },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(255,227,180,0.04)', border: '1px solid var(--border)',
    borderRadius: '10px', padding: '8px 14px', minWidth: '260px',
  },
  searchInput: {
    background: 'none', border: 'none', outline: 'none',
    color: 'var(--text-primary)', fontSize: '0.875em', flex: 1, fontFamily: 'inherit',
  },
  searchClear: { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', opacity: 0.5, fontSize: '0.875em' },
  tabBar: {
    display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)',
    marginBottom: '28px', flexWrap: 'wrap',
  },
  tab: {
    padding: '10px 20px', background: 'none', border: 'none', borderBottom: '2px solid transparent',
    color: 'var(--text-secondary)', opacity: 0.6, cursor: 'pointer', fontSize: '0.875em',
    fontWeight: 500, whiteSpace: 'nowrap', marginBottom: '-1px', transition: 'all 0.15s', fontFamily: 'inherit',
  },
  tabActive: { opacity: 1, color: 'var(--highlight)', borderBottom: '2px solid var(--highlight)', fontWeight: 700 },

  // Overview
  overviewGreeting: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: '24px', gap: '16px', flexWrap: 'wrap' as const,
  },
  greetTitle: { fontSize: '1.3em', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' },
  greetSub: { fontSize: '0.83em', color: 'var(--text-secondary)', opacity: 0.55, margin: '4px 0 0' },
  quickActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' as const },
  qaBtn: {
    padding: '9px 18px', background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.3)',
    borderRadius: '8px', color: '#2dd4bf', fontWeight: 600, fontSize: '0.83em', textDecoration: 'none',
    cursor: 'pointer',
  },
  sectionTitle: { fontSize: '0.7em', fontWeight: 700, color: 'var(--text-secondary)', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '1px', margin: '24px 0 12px' },

  // Health
  loading: { color: 'var(--text-secondary)', opacity: 0.5, fontSize: '0.875em' },
  currencyBanner: {
    background: 'rgba(255,227,180,0.05)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '10px 14px', marginBottom: '20px',
    fontSize: '0.875em', color: 'var(--text-secondary)',
  },
  healthStrip: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' },
  healthCard: {
    borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  healthLabel: { fontSize: '0.7em', color: 'var(--text-secondary)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 },
  healthValue: { fontSize: '1.4em', fontWeight: 700 },
  catGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '28px' },
  catCard: {
    borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center',
  },
  catName: { fontSize: '0.72em', color: 'var(--text-secondary)', opacity: 0.6, textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.4px' },
  catAmt: { fontSize: '0.95em', fontWeight: 700, color: 'var(--text-primary)' },
  budgetList: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' },
  budgetRow: { display: 'flex', alignItems: 'center', gap: '14px' },
  budgetCat: { width: '160px', fontSize: '0.83em', color: 'var(--text-secondary)', flexShrink: 0 },
  budgetBar: { flex: 1, height: '6px', background: 'rgba(255,227,180,0.08)', borderRadius: '3px', overflow: 'hidden' },
  budgetBarFill: { height: '100%', borderRadius: '3px', transition: 'width 0.4s' },
  budgetPct: { width: '40px', textAlign: 'right', fontSize: '0.8em', fontWeight: 700, flexShrink: 0 },
  budgetAmt: { width: '120px', textAlign: 'right', fontSize: '0.75em', color: 'var(--text-secondary)', opacity: 0.5, flexShrink: 0 },
  seeAll: { fontSize: '0.83em', color: 'var(--highlight)', fontWeight: 600, textDecoration: 'none' },
  emptyHint: { textAlign: 'center', marginTop: '60px', color: 'var(--text-secondary)', opacity: 0.5, fontSize: '0.875em' },

  // Visa
  visaTracker: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
    marginBottom: '28px', maxWidth: '480px',
  },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.72em', color: 'var(--text-secondary)', opacity: 0.65, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' },
  input: {
    padding: '10px 12px', background: 'rgba(255,227,180,0.04)', border: '1px solid var(--border)',
    borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.875em', outline: 'none', fontFamily: 'inherit',
  },
  hoursResult: { display: 'flex', flexDirection: 'column', gap: '8px' },
  hoursBarTrack: { height: '8px', background: 'rgba(255,227,180,0.08)', borderRadius: '4px', overflow: 'hidden' },
  hoursBarFill: { height: '100%', borderRadius: '4px', transition: 'width 0.4s' },
  visaRulesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' },
  visaCard: {
    borderRadius: '12px', padding: '20px',
  },
  visaCardTitle: { color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95em', margin: '0 0 12px' },
  visaRuleList: { margin: 0, paddingLeft: '18px' },
  visaRuleItem: { color: 'var(--text-secondary)', opacity: 0.7, fontSize: '0.83em', lineHeight: 1.7, marginBottom: '6px' },

  // Resources
  resourcesIntro: { color: 'var(--text-secondary)', opacity: 0.7, lineHeight: 1.7, marginBottom: '28px', fontSize: '0.875em' },
  resSection: { marginBottom: '32px' },
  resSectionTitle: { fontSize: '0.875em', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' },
  resGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' },
  resCard: {
    borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px',
  },
  resLabel: { fontSize: '0.875em', fontWeight: 600, color: 'var(--text-primary)', margin: 0 },
  resDetail: { fontSize: '0.78em', color: 'var(--text-secondary)', opacity: 0.55, margin: 0, lineHeight: 1.55 },
};
