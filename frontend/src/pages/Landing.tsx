import { Link } from 'react-router-dom';
import { Bot, TrendingUp, DollarSign, Bell, GraduationCap, BookOpen, Users } from 'lucide-react';

const features = [
  {
    Icon: Bot,
    title: 'AI-Powered Insights',
    description: 'Get personalized financial recommendations powered by advanced AI'
  },
  {
    Icon: TrendingUp,
    title: 'Budget Forecasting',
    description: 'Predict your future expenses with time-series analysis'
  },
  {
    Icon: DollarSign,
    title: 'Multi-Currency Support',
    description: 'Manage finances across multiple currencies seamlessly'
  },
  {
    Icon: Bell,
    title: 'Smart Alerts',
    description: 'Stay on track with intelligent budget notifications'
  }
];

export default function Landing() {
  return (
    <div style={styles.container}>
      <div style={styles.hero} className="fade-in">
        <h1 style={styles.title}>Spendemic</h1>
        <h2 style={styles.subtitle}>
          AI Financial Guide App for International Students
        </h2>
        <p style={styles.tagline}>
          One-stop solution for all things finance
        </p>

        <div style={styles.illustration}>
          <div style={styles.illustrationIcons}>
            <GraduationCap size={60} style={styles.illustrationIcon} />
            <BookOpen size={50} style={styles.illustrationIcon} />
            <Users size={55} style={styles.illustrationIcon} />
          </div>
          <p style={styles.illustrationCaption}>
            Students on their way to success!
          </p>
        </div>

        <Link to="/dashboard" style={styles.ctaButton} className="pulse">
          Get Started →
        </Link>
      </div>

      <div style={styles.featuresSection}>
        <h3 style={styles.featuresTitle}>Why Choose Spendemic?</h3>
        <div style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <div
              key={index}
              style={{
                ...styles.featureCard,
                animationDelay: `${index * 0.1}s`
              }}
              className="fade-in"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 15px 45px rgba(255, 215, 0, 0.3), 0 0 30px rgba(255, 215, 0, 0.2)';
                e.currentTarget.style.borderColor = 'var(--brand-gold)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.4)';
                e.currentTarget.style.borderColor = 'var(--brand-maroon-light)';
              }}
            >
              <div style={styles.featureIcon}>
                <feature.Icon size={48} strokeWidth={1.5} />
              </div>
              <h4 style={styles.featureTitle}>{feature.title}</h4>
              <p style={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  hero: {
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '20px',
    marginBottom: '60px',
  },
  title: {
    fontSize: '5em',
    background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold-dark) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    margin: 0,
    textShadow: '0 0 30px rgba(255, 215, 0, 0.3)',
    fontWeight: 800,
  },
  subtitle: {
    fontSize: '1.8em',
    color: 'var(--brand-rose)',
    margin: 0,
    fontWeight: 500,
  },
  tagline: {
    fontSize: '1.2em',
    color: 'var(--brand-gold)',
    marginTop: '10px',
    fontStyle: 'italic',
    opacity: 0.9,
  },
  illustration: {
    margin: '40px 0',
    padding: '40px',
    background: 'linear-gradient(135deg, var(--brand-maroon) 0%, var(--brand-maroon-light) 100%)',
    borderRadius: '20px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 215, 0, 0.2)',
    border: '2px solid var(--brand-gold)',
  },
  illustrationIcons: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '30px',
    marginBottom: '20px',
  },
  illustrationIcon: {
    color: 'var(--brand-gold)',
    filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))',
  },
  illustrationCaption: {
    fontSize: '1.2em',
    color: 'var(--brand-gold)',
    fontWeight: 600,
    margin: 0,
  },
  ctaButton: {
    marginTop: '20px',
    padding: '18px 50px',
    background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold-dark) 100%)',
    color: 'var(--brand-maroon)',
    borderRadius: '12px',
    fontSize: '1.3em',
    fontWeight: 700,
    textDecoration: 'none',
    display: 'inline-block',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    boxShadow: '0 8px 25px rgba(255, 215, 0, 0.4)',
  },
  featuresSection: {
    marginTop: '80px',
  },
  featuresTitle: {
    fontSize: '2.5em',
    color: 'var(--brand-gold)',
    textAlign: 'center' as const,
    marginBottom: '50px',
    fontWeight: 700,
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '30px',
  },
  featureCard: {
    background: 'linear-gradient(135deg, var(--brand-maroon) 0%, var(--brand-maroon-dark) 100%)',
    padding: '30px',
    borderRadius: '16px',
    textAlign: 'center' as const,
    border: '1px solid var(--brand-maroon-light)',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  },
  featureIcon: {
    color: 'var(--brand-gold)',
    marginBottom: '15px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))',
  },
  featureTitle: {
    fontSize: '1.4em',
    color: 'var(--brand-gold)',
    marginBottom: '12px',
    fontWeight: 600,
  },
  featureDescription: {
    fontSize: '1em',
    color: 'var(--brand-rose)',
    lineHeight: 1.6,
    margin: 0,
  },
};
