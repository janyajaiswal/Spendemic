import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Settings from './pages/Settings';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import './App.css';

const GOOGLE_CLIENT_ID = '693710411372-63m1l5lqh390jll6lqgpci97d4hi0i7l.apps.googleusercontent.com';

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <div className="app-container">
            <Sidebar />
            <div className="main-content">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/budgets" element={<Budgets />} />
                <Route path="/expenses" element={<Transactions />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </div>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
