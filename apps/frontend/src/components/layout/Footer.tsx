import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 space-y-1">
        <p>ProyectoDACS — Plataforma de Apoyo a Pequeños Productores Agropecuarios</p>
        <p className="text-slate-400">
          Diseño para cátedra de Arquitectura Cliente-Servidor (DACS). Integración con Open-Meteo, Matba Rofex y Keycloak.
        </p>
      </div>
    </footer>
  );
};
