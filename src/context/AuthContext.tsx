import { createContext, useCallback, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { LoginCredentials, AuthState, UserRole } from '../types';
import { authAPI } from '../api/auth';

// Check if dev mode is enabled via environment variable
const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  setDemoUser: (role: UserRole) => void;
  isDevMode: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

// Demo users for testing (available in dev mode)
const demoUsers: Record<UserRole, { username: string; name: string; email: string; team: string }> = {
  collector: { username: 'mrodriguez', name: 'Maria Rodriguez', email: 'mrodriguez@msbureau.com', team: 'Collections' },
  admin: { username: 'lmartinez', name: 'Lisa Martinez', email: 'lmartinez@msbureau.com', team: 'Client Services' },
  supervisor: { username: 'omalik', name: 'Omar Malik', email: 'omalik@msbureau.com', team: 'Management' },
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(() => {
    // In dev mode, start with a demo user
    if (DEV_MODE) {
      return {
        user: {
          id: 'demo-supervisor',
          username: demoUsers.supervisor.username,
          name: demoUsers.supervisor.name,
          email: demoUsers.supervisor.email,
          role: 'supervisor',
          team: demoUsers.supervisor.team,
        },
        token: 'dev-token',
        isAuthenticated: true,
        isLoading: false,
      };
    }

    // In production, start with loading state
    return {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
    };
  });

  // Initialize auth state on mount (production mode only)
  useEffect(() => {
    if (DEV_MODE) return; // Skip in dev mode

    const initAuth = async () => {
      const token = authAPI.getStoredToken();

      if (!token) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      // Check if token is expired
      if (authAPI.isTokenExpired(token)) {
        try {
          // Try to refresh
          const response = await authAPI.refreshToken();
          setState({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // Refresh failed, clear auth
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
        return;
      }

      // Token is valid, get current user
      try {
        const user = await authAPI.getCurrentUser();
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        // Failed to get user, clear auth
        localStorage.removeItem('auth_token');
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await authAPI.login(credentials);
      setState({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Only call API logout in production mode
      if (!DEV_MODE) {
        await authAPI.logout();
      }
    } finally {
      // In dev mode, reset to default demo user
      if (DEV_MODE) {
        setState({
          user: {
            id: 'demo-supervisor',
            username: demoUsers.supervisor.username,
            name: demoUsers.supervisor.name,
            email: demoUsers.supervisor.email,
            role: 'supervisor',
            team: demoUsers.supervisor.team,
          },
          token: 'dev-token',
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    }
  }, []);

  const hasRole = useCallback(
    (roles: UserRole | UserRole[]): boolean => {
      if (!state.user) return false;

      const roleArray = Array.isArray(roles) ? roles : [roles];
      return roleArray.includes(state.user.role);
    },
    [state.user]
  );

  // Set demo user by role (only works in dev mode)
  const setDemoUser = useCallback((role: UserRole) => {
    if (!DEV_MODE) {
      console.warn('setDemoUser is only available in development mode');
      return;
    }

    const demoUser = demoUsers[role];
    setState({
      user: {
        id: `demo-${role}`,
        username: demoUser.username,
        name: demoUser.name,
        email: demoUser.email,
        role,
        team: demoUser.team,
      },
      token: 'dev-token',
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    hasRole,
    setDemoUser,
    isDevMode: DEV_MODE,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
