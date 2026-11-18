export interface User {
  id: string;
  email: string;
  username?: string;
  name?: string;
  created_at?: string;
}

export interface AuthResponse {
  message?: string;
  token: string;
  user: User;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    credentialsOrIdentifier: string | { name?: string; email?: string; username?: string; password?: string },
    password?: string
  ) => Promise<void>;
  signup: (email: string, password: string, username?: string, name?: string) => Promise<void>;
  updateProfile: (data: { name?: string; username?: string }) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}
