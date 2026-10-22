import React, { useCallback, useMemo, useState } from 'react';
import { AuthContext, type UserProfile } from './auth-context';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estado local desacoplado, preparado para ser alimentado por keycloak-js
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('dacs_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('dacs_token'));
  const [isLoading] = useState<boolean>(false);

  const login = useCallback(() => {
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
    localStorage.setItem('token', mockToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('dacs_user');
    localStorage.removeItem('dacs_token');
    localStorage.removeItem('token');
  }, []);

  const register = useCallback(() => {
    // Redirección a Keycloak registration flow
    login();
  }, [login]);

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
    [user, token, isLoading, login, logout, register],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
