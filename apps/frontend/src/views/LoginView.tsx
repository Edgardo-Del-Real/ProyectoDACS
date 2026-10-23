import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/panel';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Por favor, completá todos los campos.');
      return;
    }

    setCargando(true);
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión.';
      setError(message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-8 sm:my-16">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 text-2xl font-bold flex items-center justify-center mx-auto shadow-sm">
            🌾
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Iniciar Sesión</h1>
          <p className="text-sm text-slate-500">
            Ingresá a tu cuenta para gestionar tus parcelas y clima
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <span className="font-bold">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold uppercase text-slate-700 mb-1">
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="productor@ejemplo.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold uppercase text-slate-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2"
          >
            {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            ¿Todavía no tenés una cuenta?{' '}
            <Link to="/registro" className="font-semibold text-emerald-600 hover:text-emerald-700 underline">
              Registrate acá
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
