import { NavLink, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Wallet, CreditCard, TrendingUp, Settings, LogIn, LogOut, Bell, HelpCircle, Volume2, VolumeX, Moon, Sun } from 'lucide-react';
import { googleLogout } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import '../styles/sidebar.css';

const API = 'http://localhost:8000/api/v1';

interface AlertItem {
  budget_id: string;
  category: string;
  type: 'BUDGET_EXCEEDED' | 'APPROACHING_LIMIT';
  message: string;
  utilization: number;
}

const navigationItems = [
  { label: 'Dashboard', path: '/dashboard', Icon: LayoutDashboard },
  { label: 'Budgets', path: '/budgets', Icon: Wallet },
  { label: 'Transactions', path: '/transactions', Icon: CreditCard },
  { label: 'Reports', path: '/reports', Icon: TrendingUp },
  { label: 'Settings', path: '/settings', Icon: Settings },
  { label: 'FAQ', path: '/faq', Icon: HelpCircle },
];

const playChime = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
  } catch { /* AudioContext not available */ }
};

export default function Sidebar() {
  const { user, logout, isAuthenticated } = useAuth();
  const [alertItems, setAlertItems] = useState<AlertItem[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('spendemic_sound') !== 'false'; } catch { return true; }
  });
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('spendemic_theme') !== 'light'; } catch { return true; }
  });
  const prevAlertCount = useRef(0);

  useEffect(() => {
    const token = user?.accessToken;
    if (!token) { setAlertItems([]); return; }
    fetch(`${API}/alerts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((data: AlertItem[]) => {
        setAlertItems(data);
        if (soundEnabled && data.length > prevAlertCount.current && data.length > 0) {
          playChime();
        }
        prevAlertCount.current = data.length;
      })
      .catch(() => {});
  }, [user, soundEnabled]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try { localStorage.setItem('spendemic_sound', String(next)); } catch { /* ignore */ }
    const token = user?.accessToken;
    if (token) {
      fetch(`${API}/users/me/notification-preferences`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sound_enabled: next }),
      }).catch(() => {});
    }
  };

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    try { localStorage.setItem('spendemic_theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
  };

  const handleLogout = () => { googleLogout(); logout(); };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <Link to="/" className="sidebar-logo-text">Spendemic</Link>
        <p className="sidebar-logo-subtext">AI Financial Guide</p>
        <div className="sidebar-logo-divider" />
      </div>

      <nav className="sidebar-nav">
        {navigationItems.map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}>
            <item.Icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {isAuthenticated && alertItems.length > 0 && (
        <div ref={bellRef} style={{ position: 'relative' }}>
          <button className="sidebar-bell-btn" onClick={() => setBellOpen(o => !o)}
            title={`${alertItems.length} budget alert${alertItems.length > 1 ? 's' : ''}`}>
            <Bell size={18} />
            <span className="sidebar-bell-badge">{alertItems.length}</span>
          </button>
          {bellOpen && (
            <div className="sidebar-bell-dropdown">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: '0.75em', color: 'var(--brand-gold)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Budget Alerts</span>
                <button onClick={toggleSound} title={soundEnabled ? 'Mute alerts' : 'Unmute alerts'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: soundEnabled ? 'var(--brand-gold)' : 'rgba(255,255,255,0.3)', padding: '2px 4px' }}>
                  {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                </button>
              </div>
              {alertItems.map((a, i) => (
                <div key={i} className="sidebar-bell-item"
                  style={{ borderLeft: `3px solid ${a.type === 'BUDGET_EXCEEDED' ? '#f87171' : '#fbbf24'}` }}>
                  <span style={{ fontSize: '0.8em', fontWeight: 600, color: a.type === 'BUDGET_EXCEEDED' ? '#f87171' : '#fbbf24' }}>
                    {a.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAuthenticated && user ? (
        <div className="sidebar-user-section">
          <div className="sidebar-user-info">
            <img src={user.picture} alt={user.name} className="sidebar-avatar" referrerPolicy="no-referrer" />
            <div className="sidebar-user-details">
              <span className="sidebar-user-name">{user.name}</span>
              <span className="sidebar-user-email">{user.email}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-logout-btn">
            <LogOut size={16} /> Logout
          </button>
        </div>
      ) : (
        <NavLink to="/auth" className={({ isActive }) => `sidebar-signin-btn${isActive ? ' active' : ''}`}>
          <LogIn size={18} /> Sign In / Sign Up
        </NavLink>
      )}

      <div className="sidebar-footer">
        <button onClick={toggleTheme} className="sidebar-theme-btn" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>
        <p className="sidebar-footer-text">Master's Project</p>
        <p className="sidebar-footer-subtext">CPSC 597 • CSUF</p>
      </div>
    </div>
  );
}
