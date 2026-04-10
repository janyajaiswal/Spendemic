import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface GoogleUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
  accessToken?: string;
  onboarding_completed?: boolean;
}

interface AuthContextType {
  user: GoogleUser | null;
  login: (credential: string) => Promise<void>;
  loginDirect: (user: GoogleUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const STORAGE_KEY = 'spendemic_user';
const API_BASE = 'http://localhost:8000';

function decodeGoogleJwt(credential: string): GoogleUser {
  const base64Url = credential.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const payload = JSON.parse(window.atob(padded)) as Record<string, string>;
  return {
    sub: payload['sub'] ?? '',
    email: payload['email'] ?? '',
    name: payload['name'] ?? '',
    picture: payload['picture'] ?? '',
  };
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as GoogleUser;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (credential: string): Promise<void> => {
    // picture is not stored in DB yet — always pull from local JWT decode
    const localDecoded = decodeGoogleJwt(credential);

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      if (!response.ok) {
        throw new Error(`Backend auth failed with status ${response.status}`);
      }

      const data = await response.json() as {
        access_token: string;
        token_type: string;
        user: { id: string; email: string; name: string; onboarding_completed: boolean };
      };

      const googleUser: GoogleUser = {
        sub: data.user.id,
        email: data.user.email,
        name: data.user.name,
        picture: localDecoded.picture,
        accessToken: data.access_token,
        onboarding_completed: data.user.onboarding_completed,
      };

      setUser(googleUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(googleUser));
    } catch (err) {
      // Graceful fallback: backend offline → use local decode so dev flow still works
      console.warn('Backend auth unavailable, using local JWT decode:', err);
      setUser(localDecoded);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localDecoded));
    }
  }, []);

  const loginDirect = useCallback((u: GoogleUser) => {
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const token = stored ? (JSON.parse(stored) as GoogleUser).accessToken : undefined;
    if (token) {
      fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, loginDirect, logout, isAuthenticated: user !== null }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
