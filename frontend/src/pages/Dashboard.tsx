/**
 * Dashboard — multi-tab overview for international students.
 *
 * Tabs:
 *  0  Overview      — app feature cards + quick links (fill in your own copy)
 *  1  Financial Health — live income/expense summary + budget status
 *  2  Visa & Work   — work-hours tracker + visa rule pointers (fill in copy)
 *  3  Resources     — curated links/tips for int'l students (fill in copy)
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import '../styles/dashboard.css';

const API = 'http://localhost:8000/api/v1';

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
// Feature card data for Overview tab
// Fill in `desc` with your own copy.
// ─────────────────────────────────────────────────────
const FEATURES = [
  {
    title: 'Transactions',
    desc: 'Log every dollar in and out — in any currency. Spendemic auto-converts to your working currency, flags duplicates, and supports recurring payments so you never miss a bill.',
    link: '/transactions',
    linkLabel: 'Go to Transactions',
  },
  {
    title: 'Budgets & Goals',
    desc: 'Set monthly or weekly spending caps by category. Live progress bars show how much you\'ve used, and you\'ll get alerts at 80% and 100%. Create savings goals and fund them from your monthly surplus.',
    link: '/budgets',
    linkLabel: 'Manage Budgets',
  },
  {
    title: 'AI Forecasting',
    desc: 'Amazon Chronos-2, a zero-shot probabilistic time-series model, predicts your future income and expenses using historical transactions plus your forecast context (rent, breaks, tuition).',
    link: '/reports',
    linkLabel: 'View Reports',
  },
  {
    title: 'Multi-Currency',
    desc: 'Live exchange rates keep every transaction accurate. Set a home currency and a working currency — Spendemic shows all three values side by side so you always know what you\'re spending.',
    link: '/transactions',
    linkLabel: 'Add Transaction',
  },
  {
    title: 'Recurring Transactions',
    desc: 'Mark rent, subscriptions, or stipends as recurring. The system automatically generates future entries on your chosen schedule (daily, weekly, bi-weekly, monthly, or annually).',
    link: '/transactions',
    linkLabel: 'See Transactions',
  },
  {
    title: 'What-If Scenarios',
    desc: 'Simulate hypothetical changes — a raise, an unexpected tuition bill, or a summer stipend — and instantly see the impact on your monthly net. Scenarios never touch your real data.',
    link: '/transactions',
    linkLabel: 'Try a Scenario',
  },
  {
    title: 'Visa & Work Compliance',
    desc: 'Track your weekly work hours against your visa cap (F-1 students: 20 hrs/wk on-campus during the semester). The Visa & Work tab gives a real-time compliance check.',
    link: '/dashboard',
    linkLabel: 'Check Compliance',
  },
  {
    title: 'Smart Alerts',
    desc: 'Rule-based notifications fire when any budget category hits 80% or exceeds its limit. Enable sound alerts for an audio chime whenever a new alert arrives — configurable per-device.',
    link: '/settings',
    linkLabel: 'Configure Alerts',
  },
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

// ─────────────────────────────────────────────────────
// Resources tab sections
// Fill in each tip or link yourself.
// ─────────────────────────────────────────────────────
const RESOURCE_SECTIONS: { title: string; items: { label: string; detail: string; href?: string }[] }[] = [
  {
    title: 'Banking & Finances',
    items: [
      { label: 'Open a US bank account as an international student', detail: 'Most banks require a passport, I-20/DS-2019, and an SSN or ITIN. Chase, Bank of America, and credit unions like SchoolsFirst are popular choices at CSUF.', href: 'https://www.bankofamerica.com/student-banking/' },
      { label: 'Build US credit without a credit history', detail: 'Secured credit cards (Discover it Secured, Capital One) and credit-builder loans let you establish a credit score. Aim for a score above 700 before graduation.', href: 'https://www.discover.com/credit-cards/secured/' },
      { label: 'Send money home cheaply (Wise, Remitly)', detail: 'Wise offers mid-market exchange rates with transparent fees — typically 5–10× cheaper than a bank wire. Remitly is fast for urgent transfers.', href: 'https://wise.com/' },
    ],
  },
  {
    title: 'Scholarships & Aid',
    items: [
      { label: 'CSUF International Student Scholarships', detail: 'CSUF\'s scholarship portal lists merit-based awards open to F-1/J-1 students. Apply each semester via the CSUF Scholarship Application.', href: 'https://www.fullerton.edu/financialaid/scholarships/' },
      { label: 'CalFresh (food assistance) for eligible students', detail: 'Some international students with certain immigration statuses are eligible. Visit the Student Wellness Center or CAPS for a screener.', href: 'https://www.fullerton.edu/studentwellness/calfresh/' },
      { label: 'ISSS Emergency Fund', detail: 'CSUF\'s International Student Services offers emergency micro-grants for students facing unexpected financial hardship.', href: 'https://www.fullerton.edu/isss/' },
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
      { label: 'CSUF Student Health Insurance (SHIP)', detail: 'CSUF requires health insurance coverage. The Student Health Insurance Plan (SHIP) is administered through Academic HealthPlans and covers most medical needs.', href: 'https://studenthealth.fullerton.edu/' },
      { label: 'Medi-Cal eligibility for students', detail: 'Certain visa holders (including DACA, certain humanitarian statuses) may qualify for low-cost Medi-Cal coverage. Check Covered California for income-based options.', href: 'https://www.coveredca.com/' },
    ],
  },
];

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
export default function Dashboard() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<ComputedSummary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [cashflow, setCashflow] = useState<{ month: string; income: number; expenses: number }[]>([]);

  // Work-hours tracker state (visa tab) — persisted to localStorage
  const [hoursWorked, setHoursWorked] = useState(() => localStorage.getItem('visa_hours') ?? '');
  const [visaType, setVisaType] = useState(() => localStorage.getItem('visa_type') ?? 'F-1 (Academic)');
  const hoursCap = visaType === 'F-1 (Academic)' ? 20 : visaType === 'J-1 (Exchange Visitor)' ? 20 : 20;
  const [jobsTotalIncome, setJobsTotalIncome] = useState<number | null>(null);

  useEffect(() => { localStorage.setItem('visa_hours', hoursWorked); }, [hoursWorked]);
  useEffect(() => { localStorage.setItem('visa_type', visaType); }, [visaType]);

  useEffect(() => {
    if (activeTab !== 'visa') return;
    const token = user?.accessToken ?? localStorage.getItem('spendemic_token') ?? '';
    if (!token) return;
    fetch(`${API}/jobs/total-income`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setJobsTotalIncome(d.total_monthly_income ?? 0); })
      .catch(() => {});
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab !== 'health') return;
    const token = user?.accessToken ?? localStorage.getItem('spendemic_token') ?? '';
    if (!token) return; // not logged in yet — wait for user to load
    setSummary(null);
    setLoadingHealth(true);
    const today = new Date();
    const authHdr = { Authorization: `Bearer ${token}` };

    (async () => {
      try {
        // 1. Get user's working currency
        const profileRes = await fetch(`${API}/users/me`, { headers: authHdr });
        const profileData = profileRes.ok ? await profileRes.json() : null;
        const workingCurrency: string = profileData?.study_country_currency ?? 'USD';

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
      } finally {
        setLoadingHealth(false);
      }
    })();
  }, [activeTab, user]);

  // Search filters feature cards and resource items
  const q = search.toLowerCase();
  const filteredFeatures = FEATURES.filter(f =>
    !q || f.title.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q)
  );

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
            placeholder="Search features, tips, resources…"
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
        <div>
          {/* Hero banner — fill in your own tagline */}
          <div style={s.hero}>
            <h2 style={s.heroTitle}>
              {/* [Write your app tagline here — e.g. "Smart money management for international students"] */}
              Smart money management for international students
            </h2>
            <p style={s.heroSub}>
              Spendemic is an AI-powered financial planning app built specifically for international students. Track income and expenses in any currency, set budgets by category, and get probabilistic spending forecasts powered by Amazon Chronos-2 — all while staying on top of visa work-hour limits and scholarship deadlines. Unlike generic budgeting apps, Spendemic understands your world: tuition cycles, break periods, multi-currency remittances, and the financial pressures unique to studying abroad.
            </p>
          </div>

          <h3 style={s.sectionTitle}>
            {search ? `Results for "${search}"` : 'Everything Spendemic can do'}
          </h3>
          <div style={s.featureGrid}>
            {filteredFeatures.map(f => (
              <div key={f.title} className="dash-card" style={s.featureCard}>
                <h4 style={s.featureTitle}>{f.title}</h4>
                <p style={s.featureDesc}>{f.desc}</p>
                <Link to={f.link} style={s.featureLink}>
                  {f.linkLabel} →
                </Link>
              </div>
            ))}
            {filteredFeatures.length === 0 && (
              <p style={s.noResults}>No features match "{search}"</p>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: FINANCIAL HEALTH ── */}
      {activeTab === 'health' && (
        <div>
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
              <h3 style={s.sectionTitle}>This month at a glance</h3>
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
                  <h3 style={s.sectionTitle}>Budget status</h3>
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
                  <h3 style={s.sectionTitle}>6-Month Cash Flow</h3>
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
        <div>
          {/* Work hours tracker */}
          <h3 style={s.sectionTitle}>Weekly work-hours tracker</h3>
          <div style={s.visaTracker}>
            <div style={s.formGroup}>
              <label style={s.label}>Your visa type</label>
              <select style={s.input} value={visaType} onChange={e => setVisaType(e.target.value)}>
                {VISA_RULES.map(v => <option key={v.visa}>{v.visa}</option>)}
              </select>
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Hours worked this week</label>
              <input style={s.input} type="number" min="0" max="168" step="0.5"
                placeholder="0" value={hoursWorked}
                onChange={e => setHoursWorked(e.target.value)} />
            </div>
            {hoursWorked !== '' && (
              <div style={s.hoursResult}>
                <div style={s.hoursBarTrack}>
                  <div style={{
                    ...s.hoursBarFill,
                    width: `${Math.min(Number(hoursWorked) / hoursCap, 1) * 100}%`,
                    background: Number(hoursWorked) > hoursCap ? '#f87171'
                      : Number(hoursWorked) >= hoursCap * 0.8 ? '#fbbf24' : '#4ade80',
                  }} />
                </div>
                <p style={{ color: Number(hoursWorked) > hoursCap ? '#f87171' : '#4ade80', fontWeight: 600 }}>
                  {Number(hoursWorked) > hoursCap
                    ? `${(Number(hoursWorked) - hoursCap).toFixed(1)} hrs over the ${hoursCap}-hr limit`
                    : `${(hoursCap - Number(hoursWorked)).toFixed(1)} hrs remaining this week`}
                </p>
              </div>
            )}
          </div>

          {/* Jobs total income */}
          {jobsTotalIncome !== null && (
            <div style={{ background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.72em', color: 'var(--text-secondary)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total Monthly Income (all active jobs)</p>
                <p style={{ margin: '4px 0 0', fontSize: '1.4em', fontWeight: 700, color: '#2dd4bf' }}>
                  ${jobsTotalIncome.toFixed(2)}/mo
                </p>
              </div>
              <Link to="/settings" style={{ fontSize: '0.875em', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                Manage jobs →
              </Link>
            </div>
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
        <div>
          <p style={s.resourcesIntro}>
            Curated guides and links for international students navigating finances in the US. Covers banking, scholarships, taxes, and health insurance — everything you need beyond the classroom.
          </p>
          {RESOURCE_SECTIONS
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
  hero: {
    background: 'rgba(255,227,180,0.04)',
    border: '1px solid var(--border)', borderRadius: '14px',
    padding: '32px', marginBottom: '32px',
  },
  heroTitle: { fontSize: '1.4em', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px', letterSpacing: '-0.3px' },
  heroSub: { color: 'var(--text-secondary)', opacity: 0.7, lineHeight: 1.7, margin: 0, fontSize: '0.875em' },
  sectionTitle: { fontSize: '0.7em', fontWeight: 700, color: 'var(--text-secondary)', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '1px', margin: '24px 0 12px' },
  featureGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' },
  featureCard: {
    borderRadius: '12px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  featureTitle: { fontSize: '1em', fontWeight: 700, margin: 0, color: 'var(--text-primary)' },
  featureDesc: { fontSize: '0.83em', color: 'var(--text-secondary)', opacity: 0.65, lineHeight: 1.6, flex: 1, margin: 0 },
  featureLink: { fontSize: '0.83em', fontWeight: 600, textDecoration: 'none', color: 'var(--highlight)' },
  noResults: { gridColumn: '1/-1', color: 'var(--text-secondary)', opacity: 0.5, textAlign: 'center' },

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
