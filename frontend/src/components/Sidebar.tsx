import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, CreditCard, TrendingUp, Settings } from 'lucide-react';

const navigationItems = [
  { label: 'Dashboard', path: '/dashboard', Icon: LayoutDashboard },
  { label: 'Budgets', path: '/budgets', Icon: Wallet },
  { label: 'Expenses', path: '/expenses', Icon: CreditCard },
  { label: 'Reports', path: '/reports', Icon: TrendingUp },
  { label: 'Settings', path: '/settings', Icon: Settings },
];

export default function Sidebar() {
  return (
    <div style={styles.sidebar}>
      <div style={styles.logo}>
        <h1 style={styles.logoText}>Spendemic</h1>
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
};
