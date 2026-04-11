import { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Settings from './pages/Settings';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Onboarding from './pages/Onboarding';
import FAQ from './pages/FAQ';
import ChatWidget from './components/ChatWidget';
import './App.css';

const GOOGLE_CLIENT_ID = '693710411372-63m1l5lqh390jll6lqgpci97d4hi0i7l.apps.googleusercontent.com';

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user } = useContext(AuthContext)!;
  if (user && (user as any).onboarding_completed === false) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<OnboardingGuard><Dashboard /></OnboardingGuard>} />
            <Route path="/budgets" element={<OnboardingGuard><Budgets /></OnboardingGuard>} />
            <Route path="/expenses" element={<OnboardingGuard><Transactions /></OnboardingGuard>} />
            <Route path="/transactions" element={<OnboardingGuard><Transactions /></OnboardingGuard>} />
            <Route path="/reports" element={<OnboardingGuard><Reports /></OnboardingGuard>} />
            <Route path="/settings" element={<OnboardingGuard><Settings /></OnboardingGuard>} />
            <Route path="/faq" element={<FAQ />} />
          </Routes>
        </div>
      </div>
      <ChatWidget />
    </>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
