import React, { createContext, useContext, useState, useMemo } from 'react';

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estado local desacoplado, preparado para ser alimentado por keycloak-js
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('dacs_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('dacs_token'));
  const [isLoading] = useState<boolean>(false);

  const login = () => {
    // Placeholder para redirección a Keycloak (realm login)
    // En desarrollo local permite probar el estado autenticado
    const mockUser: UserProfile = {
      id: 'demo-agricultor-1',
      email: 'productor@dacs.ar',
      nombre: 'Productor Demostración',
      rol: 'AGRICULTOR',
    };
    const mockToken = 'mock-jwt-token';
    setUser(mockUser);
    setToken(mockToken);
    localStorage.setItem('dacs_user', JSON.stringify(mockUser));
    localStorage.setItem('dacs_token', mockToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('dacs_user');
    localStorage.removeItem('dacs_token');
  };

  const register = () => {
    // Redirección a Keycloak registration flow
    login();
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      register,
    }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
