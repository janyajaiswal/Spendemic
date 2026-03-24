import { NavLink, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Wallet, CreditCard, TrendingUp, Settings, LogIn, LogOut, Bell } from 'lucide-react';
import { googleLogout } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';

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
  { label: 'Transactions', path: '/expenses', Icon: CreditCard },
  { label: 'Reports', path: '/reports', Icon: TrendingUp },
  { label: 'Settings', path: '/settings', Icon: Settings },
];

export default function Sidebar() {
  const { user, logout, isAuthenticated } = useAuth();
  const [alertItems, setAlertItems] = useState<AlertItem[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // Fetch alerts whenever user changes (login/logout)
  useEffect(() => {
    const token = user?.accessToken;
    if (!token) { setAlertItems([]); return; }
    fetch(`${API}/alerts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((data: AlertItem[]) => setAlertItems(data))
      .catch(() => {});
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    googleLogout();
    logout();
  };

  return (
    <div style={styles.sidebar}>
      <div style={styles.logo}>
        <Link to="/" style={styles.logoText}>Spendemic</Link>
        <p style={styles.logoSubtext}>AI Financial Guide</p>
        <div style={styles.logoDivider}></div>
      </div>

      <nav style={styles.nav}>
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
            onMouseEnter={(e) => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.backgroundColor = 'var(--brand-maroon-light)';
                e.currentTarget.style.transform = 'translateX(5px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.transform = 'translateX(0)';
              }
            }}
          >
            <item.Icon size={20} style={styles.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {isAuthenticated && alertItems.length > 0 && (
        <div ref={bellRef} style={{ position: 'relative' }}>
          <button
            style={styles.bellBtn}
            onClick={() => setBellOpen(o => !o)}
            title={`${alertItems.length} budget alert${alertItems.length > 1 ? 's' : ''}`}
          >
            <Bell size={18} />
            <span style={styles.bellBadge}>{alertItems.length}</span>
          </button>
          {bellOpen && (
            <div style={styles.bellDropdown}>
              {alertItems.map((a, i) => (
                <div key={i} style={{
                  ...styles.bellItem,
                  borderLeft: `3px solid ${a.type === 'BUDGET_EXCEEDED' ? '#f87171' : '#fbbf24'}`,
                }}>
                  <span style={{ fontSize: '0.8em', fontWeight: 600, color: a.type === 'BUDGET_EXCEEDED' ? '#f87171' : '#fbbf24' }}>
                    {a.type === 'BUDGET_EXCEEDED' ? '🔴' : '🟡'} {a.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAuthenticated && user ? (
        <div style={styles.userSection}>
          <div style={styles.userInfo}>
            <img
              src={user.picture}
              alt={user.name}
              style={styles.avatar}
              referrerPolicy="no-referrer"
            />
            <div style={styles.userDetails}>
              <span style={styles.userName}>{user.name}</span>
              <span style={styles.userEmail}>{user.email}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={styles.logoutButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--brand-maroon-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      ) : (
        <NavLink
          to="/auth"
          style={({ isActive }) => ({
            ...styles.signInButton,
            ...(isActive ? styles.signInButtonActive : {}),
          })}
          onMouseEnter={(e) => {
            if (!e.currentTarget.classList.contains('active')) {
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.4)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!e.currentTarget.classList.contains('active')) {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          <LogIn size={18} />
          Sign In / Sign Up
        </NavLink>
      )}

      <div style={styles.footer}>
        <p style={styles.footerText}>Master's Project</p>
        <p style={styles.footerSubtext}>CPSC 597 • CSUF</p>
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    width: '250px',
    background: 'linear-gradient(180deg, var(--brand-maroon) 0%, var(--brand-maroon-dark) 100%)',
    color: 'var(--brand-rose)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '30px',
    boxShadow: '4px 0 20px rgba(0, 0, 0, 0.5)',
    position: 'relative' as const,
  },
  logo: {
    borderBottom: '3px solid var(--brand-gold)',
    paddingBottom: '20px',
    position: 'relative' as const,
  },
  logoText: {
    fontSize: '2.2em',
    background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold-dark) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    margin: '0 0 5px 0',
    fontWeight: 800,
    textShadow: '0 0 20px rgba(255, 215, 0, 0.3)',
    display: 'block',
    textDecoration: 'none',
  },
  logoSubtext: {
    fontSize: '0.85em',
    color: 'var(--brand-rose)',
    margin: 0,
    opacity: 0.9,
  },
  logoDivider: {
    position: 'absolute' as const,
    bottom: -3,
    left: 0,
    width: '60px',
    height: '3px',
    background: 'var(--brand-gold)',
    boxShadow: '0 0 10px var(--brand-gold)',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    flex: 1,
  },
  navLink: {
    padding: '14px 18px',
    borderRadius: '10px',
    transition: 'all 0.3s ease',
    fontSize: '1.05em',
    fontWeight: 500,
    border: '1px solid transparent',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  navLinkActive: {
    background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold-dark) 100%)',
    color: 'var(--brand-maroon)',
    fontWeight: 700,
    border: '1px solid var(--brand-gold)',
    boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)',
    transform: 'translateX(5px)',
  },
  icon: {
    flexShrink: 0,
  },
  userSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid var(--brand-maroon-light)',
    background: 'rgba(0, 0, 0, 0.2)',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '2px solid var(--brand-gold)',
    flexShrink: 0,
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  userName: {
    fontSize: '0.9em',
    fontWeight: 600,
    color: 'var(--brand-gold)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userEmail: {
    fontSize: '0.75em',
    color: 'var(--brand-rose)',
    opacity: 0.7,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px',
    background: 'transparent',
    color: 'var(--brand-rose)',
    border: '1px solid var(--brand-maroon-light)',
    borderRadius: '8px',
    fontSize: '0.85em',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  signInButton: {
    padding: '12px 18px',
    borderRadius: '10px',
    border: '1px solid var(--brand-gold)',
    background: 'transparent',
    color: 'var(--brand-gold)',
    fontSize: '0.95em',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    justifyContent: 'center',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  signInButtonActive: {
    background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold-dark) 100%)',
    color: 'var(--brand-maroon)',
    fontWeight: 700,
    boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)',
  },
  footer: {
    borderTop: '2px solid var(--brand-maroon-light)',
    paddingTop: '15px',
    textAlign: 'center' as const,
  },
  footerText: {
    fontSize: '0.9em',
    color: 'var(--brand-gold)',
    margin: '0 0 5px 0',
    fontWeight: 600,
  },
  footerSubtext: {
    fontSize: '0.75em',
    color: 'var(--brand-rose)',
    margin: 0,
    opacity: 0.7,
  },
  bellBtn: {
    position: 'relative' as const,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)',
    borderRadius: '10px', padding: '10px', cursor: 'pointer',
    color: 'var(--brand-gold)', width: '100%',
  },
  bellBadge: {
    position: 'absolute' as const, top: 6, right: 6,
    background: '#f87171', color: '#fff',
    borderRadius: '50%', width: '16px', height: '16px',
    fontSize: '0.65em', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  bellDropdown: {
    position: 'absolute' as const, bottom: '110%', left: 0, right: 0,
    background: '#1a0a0e', border: '1px solid rgba(255,215,0,0.2)',
    borderRadius: '10px', padding: '8px',
    display: 'flex', flexDirection: 'column' as const, gap: '6px',
    zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
  },
  bellItem: {
    padding: '8px 10px', borderRadius: '6px',
    background: 'rgba(255,255,255,0.04)',
  },
};
