import { createContext } from 'react';

export interface UserProfile {
  id: string;
  email: string;
  nombre?: string;
  rol: 'AGRICULTOR' | 'COOPERATIVA' | 'TECNICO' | string;
}

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  register: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
