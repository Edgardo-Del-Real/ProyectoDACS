import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, login, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'Inicio', path: '/' },
    { name: 'Panel / Parcelas', path: '/panel', protected: true },
    { name: 'Mercado', path: '/mercado', protected: true },
    { name: 'Clima', path: '/clima', protected: true },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo y Branding */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-sm group-hover:bg-emerald-700 transition">
                🌾
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-emerald-700 transition">
                  ProyectoDACS
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Agro AR
                </span>
              </div>
            </Link>
          </div>

          {/* Navegación Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              if (link.protected && !isAuthenticated) return null;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                    isActive(link.path)
                      ? 'bg-emerald-50 text-emerald-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Acciones de Autenticación Desktop */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-slate-800">{user.nombre || user.email}</div>
                  <div className="text-xs font-semibold text-emerald-600">{user.rol}</div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={login}
                  className="px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  onClick={login}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
                >
                  Registrarse
                </button>
              </div>
            )}
          </div>

          {/* Botón Menú Mobile */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Abrir menú"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Menú Mobile desplegable */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-2">
          {navLinks.map((link) => {
            if (link.protected && !isAuthenticated) return null;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActive(link.path)
                    ? 'bg-emerald-50 text-emerald-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
          <div className="pt-3 border-t border-slate-100">
            {isAuthenticated && user ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-800">{user.nombre || user.email}</div>
                  <div className="text-xs text-emerald-600">{user.rol}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200"
                >
                  Salir
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    login();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full py-2 text-center text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg"
                >
                  Iniciar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
