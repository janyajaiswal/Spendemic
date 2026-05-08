import { Link } from 'react-router-dom';
import { Bot, TrendingUp, DollarSign, Bell, GraduationCap, BookOpen, Users } from 'lucide-react';
import '../styles/landing.css';

const features = [
  { Icon: Bot, title: 'AI-Powered Insights', description: 'Get personalized financial recommendations powered by advanced AI' },
  { Icon: TrendingUp, title: 'Budget Forecasting', description: 'Predict your future expenses with time-series analysis' },
  { Icon: DollarSign, title: 'Multi-Currency Support', description: 'Manage finances across multiple currencies seamlessly' },
  { Icon: Bell, title: 'Smart Alerts', description: 'Stay on track with intelligent budget notifications' },
];

export default function Landing() {
  return (
    <div className="landing-container">
      <div className="landing-hero fade-in">
        <h1 className="landing-title">Spendemic</h1>
        <h2 className="landing-subtitle">AI Financial Guide App for International Students</h2>
        <p className="landing-tagline">One-stop solution for all things finance</p>

        <div className="landing-illustration">
          <div className="landing-illustration-icons">
            <GraduationCap size={60} className="landing-illustration-icon" />
            <BookOpen size={50} className="landing-illustration-icon" />
            <Users size={55} className="landing-illustration-icon" />
          </div>
          <p className="landing-illustration-caption">Students on their way to success!</p>
        </div>

        <Link to="/dashboard" className="landing-cta pulse">Get Started →</Link>
      </div>

      <div className="landing-features-section">
        <h3 className="landing-features-title">Why Choose Spendemic?</h3>
        <div className="landing-features-grid">
          {features.map((feature, index) => (
            <div
              key={index}
              className="landing-feature-card fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="landing-feature-icon">
                <feature.Icon size={48} strokeWidth={1.5} />
              </div>
              <h4 className="landing-feature-title">{feature.title}</h4>
              <p className="landing-feature-desc">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
