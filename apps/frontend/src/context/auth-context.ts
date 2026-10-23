import { createContext } from 'react';

export type UserRole = 'AGRICULTOR' | 'COOPERATIVA' | 'TECNICO' | string;

export interface UserProfile {
  id: string;
  email: string;
  nombre?: string | null;
  rol: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  nombre?: string;
  rol?: 'AGRICULTOR' | 'COOPERATIVA' | 'TECNICO';
}

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
