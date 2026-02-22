interface PlaceholderProps {
  title: string;
}

export default function Placeholder({ title }: PlaceholderProps) {
  return (
    <div style={styles.container} className="fade-in">
      <div style={styles.card}>
        <div style={styles.iconContainer}>
          <span style={styles.icon}>🚧</span>
        </div>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.message}>Coming Soon</p>
        <p style={styles.description}>
          This page is under development and will be available soon.
        </p>
        <div style={styles.loader}>
          <div style={styles.loaderBar}></div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '60px 20px',
    textAlign: 'center' as const,
  },
  card: {
    background: 'linear-gradient(135deg, var(--brand-maroon) 0%, var(--brand-maroon-dark) 100%)',
    padding: '60px 40px',
    borderRadius: '20px',
    border: '2px solid var(--brand-gold)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 215, 0, 0.2)',
  },
  iconContainer: {
    marginBottom: '20px',
  },
  icon: {
    fontSize: '4em',
    filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))',
  },
  title: {
    fontSize: '3em',
    color: 'var(--brand-gold)',
    margin: '0 0 20px 0',
    fontWeight: 700,
  },
  message: {
    fontSize: '2em',
    background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold-dark) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    margin: '0 0 15px 0',
    fontWeight: 600,
  },
  description: {
    fontSize: '1.2em',
    color: 'var(--brand-rose)',
    lineHeight: 1.6,
    margin: '0 0 30px 0',
  },
  loader: {
    width: '200px',
    height: '6px',
    backgroundColor: 'var(--brand-maroon-dark)',
    borderRadius: '3px',
    margin: '0 auto',
    overflow: 'hidden',
  },
  loaderBar: {
    width: '50%',
    height: '100%',
    background: 'linear-gradient(90deg, var(--brand-gold) 0%, var(--brand-gold-dark) 100%)',
    borderRadius: '3px',
    animation: 'shimmer 2s ease-in-out infinite',
  },
};
