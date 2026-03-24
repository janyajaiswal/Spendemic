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
import { useAuth } from '../contexts/AuthContext';

const API = 'http://localhost:8000/api/v1';

// ─────────────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',  label: '🏠 Overview' },
  { id: 'health',    label: '📊 Financial Health' },
  { id: 'visa',      label: '🛂 Visa & Work' },
  { id: 'resources', label: '📚 Resources' },
];

// ─────────────────────────────────────────────────────
// Feature card data for Overview tab
// Fill in `desc` with your own copy.
// ─────────────────────────────────────────────────────
const FEATURES = [
  {
    emoji: '💸',
    title: 'Transactions',
    desc: '[Write 1–2 sentences: what users can do here — log income/expenses, multi-currency, recurring, what-if scenarios]',
    link: '/expenses',
    linkLabel: 'Go to Transactions',
    color: '#4ade80',
  },
  {
    emoji: '💼',
    title: 'Budgets',
    desc: '[Write 1–2 sentences: category-based spending limits, weekly or monthly, live progress bars, over-budget alerts]',
    link: '/budgets',
    linkLabel: 'Manage Budgets',
    color: '#fbbf24',
  },
  {
    emoji: '📈',
    title: 'AI Forecasting',
    desc: '[Write 1–2 sentences: Amazon Chronos time-series model predicts future spending, compares against LSTM benchmark]',
    link: '/reports',
    linkLabel: 'View Reports',
    color: '#a78bfa',
  },
  {
    emoji: '💱',
    title: 'Multi-Currency',
    desc: '[Write 1–2 sentences: live exchange rates, home currency vs working currency, automatic conversion on every transaction]',
    link: '/expenses',
    linkLabel: 'Add Transaction',
    color: '#63b3ed',
  },
  {
    emoji: '🔁',
    title: 'Recurring Transactions',
    desc: '[Write 1–2 sentences: set a transaction as recurring (daily → annually), system auto-generates entries on schedule]',
    link: '/expenses',
    linkLabel: 'See Transactions',
    color: '#f9a8d4',
  },
  {
    emoji: '🎭',
    title: 'What-If Scenarios',
    desc: '[Write 1–2 sentences: simulate hypothetical income/expenses — e.g. "if I get a raise" — without saving to your account]',
    link: '/expenses',
    linkLabel: 'Try a Scenario',
    color: '#fb923c',
  },
  {
    emoji: '🛂',
    title: 'Visa & Work Compliance',
    desc: '[Write 1–2 sentences: track weekly work hours against your visa cap, get alerts before you exceed the legal limit]',
    link: '/dashboard',
    linkLabel: 'Check Compliance',
    color: '#34d399',
  },
  {
    emoji: '🔔',
    title: 'Smart Alerts',
    desc: '[Write 1–2 sentences: rule-based notifications when budgets are 80% used, exceeded, or when recurring bills are due]',
    link: '/settings',
    linkLabel: 'Configure Alerts',
    color: '#f87171',
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
      '[Rule 1 — e.g. on-campus work limit during semester]',
      '[Rule 2 — e.g. off-campus CPT/OPT rules]',
      '[Rule 3 — e.g. summer / break exceptions]',
    ],
  },
  {
    visa: 'J-1 (Exchange Visitor)',
    rules: [
      '[Rule 1]',
      '[Rule 2]',
      '[Rule 3]',
    ],
  },
  {
    visa: 'Other / Not sure',
    rules: [
      '[Pointer to DSO / ISSS office]',
      '[Link to USCIS work authorization page]',
    ],
  },
];

// ─────────────────────────────────────────────────────
// Resources tab sections
// Fill in each tip or link yourself.
// ─────────────────────────────────────────────────────
const RESOURCE_SECTIONS = [
  {
    title: '🏦 Banking & Finances',
    items: [
      { label: '[Resource name — e.g. "Open a US bank account"]', detail: '[1-line description + link placeholder]' },
      { label: '[Resource name — e.g. "Build credit as an international student"]', detail: '[detail]' },
      { label: '[Resource name — e.g. "Remittance / sending money home cheaply"]', detail: '[detail]' },
    ],
  },
  {
    title: '🎓 Scholarships & Aid',
    items: [
      { label: '[Resource — e.g. "CSUF International Student Scholarships"]', detail: '[detail]' },
      { label: '[Resource — e.g. "CalFresh eligibility for students"]', detail: '[detail]' },
      { label: '[Resource — e.g. "Emergency funds from ISSS"]', detail: '[detail]' },
    ],
  },
  {
    title: '📋 Tax & Legal',
    items: [
      { label: '[Resource — e.g. "ITIN vs SSN — what you need"]', detail: '[detail]' },
      { label: '[Resource — e.g. "Filing taxes on F-1 / J-1 (Sprintax)"]', detail: '[detail]' },
      { label: '[Resource — e.g. "Tax treaty benefits by country"]', detail: '[detail]' },
    ],
  },
  {
    title: '🏥 Health & Insurance',
    items: [
      { label: '[Resource — e.g. "CSUF student health insurance (SHIP)"]', detail: '[detail]' },
      { label: '[Resource — e.g. "Medi-Cal eligibility for international students"]', detail: '[detail]' },
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

const CAT_EMOJI: Record<string, string> = {
  FOOD: '🍔', RENT: '🏠', TRANSPORT: '🚌', UTILITIES: '💡',
  HEALTHCARE: '🏥', EDUCATION: '📚', ENTERTAINMENT: '🎮',
  CLOTHING: '👗', PERSONAL_CARE: '💄', SAVINGS: '💰',
  SALARY: '💼', FREELANCE: '🖥️', SCHOLARSHIP: '🎓',
  FAMILY_SUPPORT: '👨‍👩‍👧', CALFRESH: '🌾', WORK_STUDY: '🏫',
  SIDE_HUSTLE: '⚡', INVESTMENT: '📈', OTHER: '📦',
};

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

  // Work-hours tracker state (visa tab) — persisted to localStorage
  const [hoursWorked, setHoursWorked] = useState(() => localStorage.getItem('visa_hours') ?? '');
  const [visaType, setVisaType] = useState(() => localStorage.getItem('visa_type') ?? 'F-1 (Academic)');
  const hoursCap = visaType === 'F-1 (Academic)' ? 20 : visaType === 'J-1 (Exchange Visitor)' ? 20 : 20;

  useEffect(() => { localStorage.setItem('visa_hours', hoursWorked); }, [hoursWorked]);
  useEffect(() => { localStorage.setItem('visa_type', visaType); }, [visaType]);

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
          <span style={s.searchIcon}>🔍</span>
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
              {/* [Write 2-3 sentences about what Spendemic does and who it's for] */}
              [Write 2–3 sentences introducing Spendemic — what it does, who it's for, and what makes it different for international students specifically.]
            </p>
          </div>

          <h3 style={s.sectionTitle}>
            {search ? `Results for "${search}"` : 'Everything Spendemic can do'}
          </h3>
          <div style={s.featureGrid}>
            {filteredFeatures.map(f => (
              <div key={f.title} style={{ ...s.featureCard, borderColor: `${f.color}30` }}>
                <span style={s.featureEmoji}>{f.emoji}</span>
                <h4 style={{ ...s.featureTitle, color: f.color }}>{f.title}</h4>
                <p style={s.featureDesc}>{f.desc}</p>
                <Link to={f.link} style={{ ...s.featureLink, color: f.color }}>
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
                  <Link to="/settings" style={{ color: 'var(--brand-gold)', fontWeight: 600 }}>Update in Settings →</Link>
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
                  <div key={c.label} style={s.healthCard}>
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
                      <div key={cat} style={s.catCard}>
                        <span style={s.catEmoji}>{CAT_EMOJI[cat] ?? '📦'}</span>
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
                          <span style={s.budgetCat}>{CAT_EMOJI[b.category] ?? '📦'} {b.category.replace(/_/g, ' ')}</span>
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

              {summary && summary.total_income === 0 && summary.total_expenses === 0 && (
                <div style={s.emptyHint}>
                  <p>No transactions this month yet.</p>
                  <Link to="/expenses" style={s.seeAll}>Add your first transaction →</Link>
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
                    ? `⚠️ ${(Number(hoursWorked) - hoursCap).toFixed(1)} hrs over the ${hoursCap}-hr limit`
                    : `✓ ${(hoursCap - Number(hoursWorked)).toFixed(1)} hrs remaining this week`}
                </p>
              </div>
            )}
          </div>

          {/* Visa rules */}
          <h3 style={s.sectionTitle}>Work authorization rules</h3>
          <div style={s.visaRulesGrid}>
            {VISA_RULES.map(v => (
              <div key={v.visa} style={s.visaCard}>
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
            {/* [Write 1-2 sentences: curated guides for international students at CSUF / in the US] */}
            [Write 1–2 sentences introducing this section — e.g. curated guides and links for international students navigating finances in the US.]
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
                      <div key={idx} style={s.resCard}>
                        <p style={s.resLabel}>{item.label}</p>
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
  page: { padding: '32px', maxWidth: '1100px', margin: '0 auto' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '16px' },
  title: { fontSize: '1.8em', fontWeight: 700, color: 'var(--brand-gold)', margin: 0 },
  subtitle: { fontSize: '0.9em', color: 'var(--brand-rose)', opacity: 0.6, margin: '4px 0 0' },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', padding: '8px 14px', minWidth: '280px',
  },
  searchIcon: { fontSize: '0.9em', opacity: 0.6 },
  searchInput: {
    background: 'none', border: 'none', outline: 'none',
    color: 'var(--brand-rose)', fontSize: '0.9em', flex: 1,
  },
  searchClear: { background: 'none', border: 'none', color: 'var(--brand-rose)', cursor: 'pointer', opacity: 0.5, fontSize: '0.85em' },
  tabBar: {
    display: 'flex', gap: '4px', borderBottom: '2px solid rgba(255,255,255,0.08)',
    marginBottom: '28px', overflowX: 'auto',
  },
  tab: {
    padding: '10px 20px', background: 'none', border: 'none', borderBottom: '2px solid transparent',
    color: 'var(--brand-rose)', opacity: 0.6, cursor: 'pointer', fontSize: '0.9em',
    fontWeight: 500, whiteSpace: 'nowrap', marginBottom: '-2px', transition: 'all 0.2s',
  },
  tabActive: { opacity: 1, color: 'var(--brand-gold)', borderBottom: '2px solid var(--brand-gold)', fontWeight: 700 },

  // Overview
  hero: {
    background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(100,20,20,0.2))',
    border: '1px solid rgba(255,215,0,0.15)', borderRadius: '16px',
    padding: '32px', marginBottom: '32px',
  },
  heroTitle: { fontSize: '1.5em', fontWeight: 700, color: 'var(--brand-gold)', margin: '0 0 12px' },
  heroSub: { color: 'var(--brand-rose)', opacity: 0.7, lineHeight: 1.7, margin: 0 },
  sectionTitle: { fontSize: '1em', fontWeight: 600, color: 'var(--brand-rose)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 16px' },
  featureGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '18px' },
  featureCard: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px',
    transition: 'transform 0.2s',
  },
  featureEmoji: { fontSize: '2em' },
  featureTitle: { fontSize: '1.05em', fontWeight: 700, margin: 0 },
  featureDesc: { fontSize: '0.85em', color: 'var(--brand-rose)', opacity: 0.6, lineHeight: 1.6, flex: 1, margin: 0 },
  featureLink: { fontSize: '0.85em', fontWeight: 600, textDecoration: 'none' },
  noResults: { gridColumn: '1/-1', color: 'var(--brand-rose)', opacity: 0.5, textAlign: 'center' },

  // Health
  loading: { color: 'var(--brand-rose)', opacity: 0.5 },
  currencyBanner: {
    background: 'rgba(255,215,0,0.07)', border: '1px solid rgba(255,215,0,0.2)',
    borderRadius: '8px', padding: '10px 14px', marginBottom: '20px',
    fontSize: '0.85em', color: 'var(--brand-rose)',
  },
  healthStrip: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' },
  healthCard: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  healthLabel: { fontSize: '0.78em', color: 'var(--brand-rose)', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.05em' },
  healthValue: { fontSize: '1.5em', fontWeight: 700 },
  catGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' },
  catCard: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center',
  },
  catEmoji: { fontSize: '1.6em' },
  catName: { fontSize: '0.72em', color: 'var(--brand-rose)', opacity: 0.55, textTransform: 'uppercase', textAlign: 'center' },
  catAmt: { fontSize: '1em', fontWeight: 700, color: 'var(--brand-rose)' },
  budgetList: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' },
  budgetRow: { display: 'flex', alignItems: 'center', gap: '14px' },
  budgetCat: { width: '160px', fontSize: '0.85em', color: 'var(--brand-rose)', flexShrink: 0 },
  budgetBar: { flex: 1, height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' },
  budgetBarFill: { height: '100%', borderRadius: '4px', transition: 'width 0.4s' },
  budgetPct: { width: '40px', textAlign: 'right', fontSize: '0.82em', fontWeight: 700, flexShrink: 0 },
  budgetAmt: { width: '120px', textAlign: 'right', fontSize: '0.78em', color: 'var(--brand-rose)', opacity: 0.5, flexShrink: 0 },
  seeAll: { fontSize: '0.85em', color: 'var(--brand-gold)', fontWeight: 600 },
  emptyHint: { textAlign: 'center', marginTop: '60px', color: 'var(--brand-rose)', opacity: 0.6 },

  // Visa
  visaTracker: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
    marginBottom: '28px', maxWidth: '480px',
  },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.82em', color: 'var(--brand-rose)', opacity: 0.7, fontWeight: 500 },
  input: {
    padding: '10px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px', color: 'var(--brand-rose)', fontSize: '0.95em', outline: 'none',
  },
  hoursResult: { display: 'flex', flexDirection: 'column', gap: '8px' },
  hoursBarTrack: { height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '5px', overflow: 'hidden' },
  hoursBarFill: { height: '100%', borderRadius: '5px', transition: 'width 0.4s' },
  visaRulesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  visaCard: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', padding: '20px',
  },
  visaCardTitle: { color: 'var(--brand-gold)', fontWeight: 700, fontSize: '0.95em', margin: '0 0 12px' },
  visaRuleList: { margin: 0, paddingLeft: '18px' },
  visaRuleItem: { color: 'var(--brand-rose)', opacity: 0.7, fontSize: '0.85em', lineHeight: 1.7 },

  // Resources
  resourcesIntro: { color: 'var(--brand-rose)', opacity: 0.7, lineHeight: 1.7, marginBottom: '28px' },
  resSection: { marginBottom: '32px' },
  resSectionTitle: { fontSize: '1em', fontWeight: 700, color: 'var(--brand-gold)', marginBottom: '14px' },
  resGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' },
  resCard: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px',
  },
  resLabel: { fontSize: '0.9em', fontWeight: 600, color: 'var(--brand-rose)', margin: 0 },
  resDetail: { fontSize: '0.78em', color: 'var(--brand-rose)', opacity: 0.5, margin: 0, lineHeight: 1.5 },
};
