import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

function TestConsumer() {
  const { user, token, isAuthenticated, isLoading, login, logout, register } = useAuth();
  return (
    <div>
      <div data-testid="is-authenticated">{isAuthenticated ? 'YES' : 'NO'}</div>
      <div data-testid="is-loading">{isLoading ? 'LOADING' : 'READY'}</div>
      <div data-testid="user-email">{user?.email ?? 'NO_USER'}</div>
      <div data-testid="token">{token ?? 'NO_TOKEN'}</div>
      <button
        type="button"
        onClick={() => login({ email: 'test@example.com', password: 'password123' })}
        data-testid="login-btn"
      >
        Login
      </button>
      <button type="button" onClick={logout} data-testid="logout-btn">
        Logout
      </button>
      <button
        type="button"
        onClick={() =>
          register({
            nombre: 'Productor Test',
            email: 'nuevo@example.com',
            password: 'password123',
            rol: 'AGRICULTOR',
          })
        }
        data-testid="register-btn"
      >
        Register
      </button>
    </div>
  );
}

describe('AuthProvider & useAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arranca desautenticado cuando localStorage está vacío', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('is-authenticated').textContent).toBe('NO');
    expect(screen.getByTestId('user-email').textContent).toBe('NO_USER');
    expect(screen.getByTestId('token').textContent).toBe('NO_TOKEN');
  });

  it('restaura sesión inicial desde localStorage si ya existía', () => {
    const fakeUser = { id: 'u1', email: 'guardado@example.com', nombre: 'Juan', rol: 'AGRICULTOR' as const };
    localStorage.setItem('dacs_token', 'token-guardado-123');
    localStorage.setItem('dacs_user', JSON.stringify(fakeUser));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('is-authenticated').textContent).toBe('YES');
    expect(screen.getByTestId('user-email').textContent).toBe('guardado@example.com');
    expect(screen.getByTestId('token').textContent).toBe('token-guardado-123');
  });

  it('login exitoso actualiza estado y almacena token en localStorage', async () => {
    const mockUser = { id: 'u2', email: 'test@example.com', nombre: 'Tester', rol: 'AGRICULTOR' as const };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'jwt-nuevo-999', user: mockUser }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(screen.getByTestId('is-authenticated').textContent).toBe('YES');
    expect(screen.getByTestId('user-email').textContent).toBe('test@example.com');
    expect(screen.getByTestId('token').textContent).toBe('jwt-nuevo-999');
    expect(localStorage.getItem('dacs_token')).toBe('jwt-nuevo-999');
    expect(JSON.parse(localStorage.getItem('dacs_user') || '{}')).toEqual(mockUser);
  });

  it('logout limpia estado y borra datos de localStorage', () => {
    const fakeUser = { id: 'u1', email: 'guardado@example.com', nombre: 'Juan', rol: 'AGRICULTOR' as const };
    localStorage.setItem('dacs_token', 'token-guardado-123');
    localStorage.setItem('dacs_user', JSON.stringify(fakeUser));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('is-authenticated').textContent).toBe('YES');

    act(() => {
      screen.getByTestId('logout-btn').click();
    });

    expect(screen.getByTestId('is-authenticated').textContent).toBe('NO');
    expect(screen.getByTestId('user-email').textContent).toBe('NO_USER');
    expect(screen.getByTestId('token').textContent).toBe('NO_TOKEN');
    expect(localStorage.getItem('dacs_token')).toBeNull();
    expect(localStorage.getItem('dacs_user')).toBeNull();
  });
});
