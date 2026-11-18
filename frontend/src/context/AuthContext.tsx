import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContextType, AuthResponse } from '../types/auth.js';
import { api, getErrorMessage } from '../utils/api.js';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'linkup_auth_token';
const USER_KEY = 'linkup_user_data';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY);
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Validate active session on initial mount
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get<{ user: User }>('/auth/me');
        setUser(response.data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
      } catch (err) {
        console.warn('[AUTH] Failed to verify existing session, clearing credentials.');
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = async (
    credentialsOrIdentifier: string | { name?: string; email?: string; username?: string; password?: string },
    password?: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      let payload: Record<string, any>;
      if (typeof credentialsOrIdentifier === 'string') {
        payload = {
          identifier: credentialsOrIdentifier,
          email: credentialsOrIdentifier,
          password,
        };
      } else {
        payload = {
          ...credentialsOrIdentifier,
          password: credentialsOrIdentifier.password || password,
        };
      }

      const response = await api.post<AuthResponse>('/auth/signin', payload);
      const { token: receivedToken, user: receivedUser } = response.data;

      localStorage.setItem(TOKEN_KEY, receivedToken);
      localStorage.setItem(USER_KEY, JSON.stringify(receivedUser));

      setToken(receivedToken);
      setUser(receivedUser);
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    email: string,
    password: string,
    username?: string,
    name?: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post<AuthResponse>('/auth/signup', {
        email,
        password,
        username,
        name,
      });
      const { token: receivedToken, user: receivedUser } = response.data;

      localStorage.setItem(TOKEN_KEY, receivedToken);
      localStorage.setItem(USER_KEY, JSON.stringify(receivedUser));

      setToken(receivedToken);
      setUser(receivedUser);
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: { name?: string; username?: string }): Promise<void> => {
    try {
      const response = await api.patch<{ user: User; message: string }>('/auth/profile', data);
      const updatedUser = response.data.user;
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const logout = (): void => {
    try {
      api.post('/auth/signout').catch(() => {});
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
    }
  };

  const clearError = () => setError(null);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    signup,
    updateProfile,
    logout,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
