import React, { useCallback, useMemo, useState } from 'react';
import {
  AuthContext,
  type AuthContextType,
  type LoginCredentials,
  type RegisterData,
  type UserProfile,
} from './auth-context';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('dacs_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('dacs_token') || localStorage.getItem('token'),
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const login = useCallback(async ({ email, password }: LoginCredentials): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Credenciales inválidas');
      }

      const data = await res.json();
      const authToken: string = data.token;
      const authUser: UserProfile = data.user;

      localStorage.setItem('dacs_token', authToken);
      localStorage.setItem('token', authToken);
      localStorage.setItem('dacs_user', JSON.stringify(authUser));

      setToken(authToken);
      setUser(authUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async (registerData: RegisterData): Promise<void> => {
      setIsLoading(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registerData),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || 'Error al registrar el usuario');
        }

        // Si el registro fue exitoso, iniciamos sesión automáticamente
        await login({ email: registerData.email, password: registerData.password });
      } finally {
        setIsLoading(false);
      }
    },
    [login],
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('dacs_user');
    localStorage.removeItem('dacs_token');
    localStorage.removeItem('token');
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login,
      logout,
      register,
    }),
    [user, token, isLoading, login, logout, register],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
