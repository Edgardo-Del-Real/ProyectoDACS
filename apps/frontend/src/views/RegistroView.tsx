import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export const RegistroView: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rol, setRol] = useState<'AGRICULTOR' | 'COOPERATIVA' | 'TECNICO'>('AGRICULTOR');

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailTrimmed = email.trim();
    if (!emailTrimmed || !password) {
      setError('Por favor, completá los campos obligatorios.');
      return;
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setCargando(true);
    try {
      await register({
        email: emailTrimmed,
        password,
        nombre: nombre.trim() || undefined,
        rol,
      });
      navigate('/panel', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al registrar usuario.';
      setError(message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-8 sm:my-12">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 text-2xl font-bold flex items-center justify-center mx-auto shadow-sm">
            🌱
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Crear Cuenta</h1>
          <p className="text-sm text-slate-500">
            Registrate para gestionar tus lotes y optimizar tu producción
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
            <label htmlFor="nombre" className="block text-xs font-semibold uppercase text-slate-700 mb-1">
              Nombre y Apellido
            </label>
            <input
              id="nombre"
              type="text"
              autoComplete="name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Juan Pérez"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-semibold uppercase text-slate-700 mb-1">
              Correo Electrónico <span className="text-red-500">*</span>
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
            <label htmlFor="rol" className="block text-xs font-semibold uppercase text-slate-700 mb-1">
              Tipo de Perfil / Rol
            </label>
            <select
              id="rol"
              value={rol}
              onChange={(e) => setRol(e.target.value as 'AGRICULTOR' | 'COOPERATIVA' | 'TECNICO')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition bg-white"
            >
              <option value="AGRICULTOR">Agricultor / Productor Agropecuario</option>
              <option value="COOPERATIVA">Cooperativa Agrícola</option>
              <option value="TECNICO">Técnico Agrónomo / Asesor</option>
            </select>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold uppercase text-slate-700 mb-1">
              Contraseña (mínimo 8 caracteres) <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase text-slate-700 mb-1">
              Confirmar Contraseña <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2"
          >
            {cargando ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            ¿Ya tenés una cuenta?{' '}
            <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700 underline">
              Iniciá sesión acá
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
