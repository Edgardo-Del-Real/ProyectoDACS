import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { HomeView } from './views/HomeView';
import { DashboardView } from './views/DashboardView';
import { LoginView } from './views/LoginView';
import { RegistroView } from './views/RegistroView';
import { NuevaParcela } from './pages/NuevaParcela';
import { DetalleParcela } from './pages/DetalleParcela';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          {/* Rutas Públicas */}
          <Route path="/" element={<HomeView />} />
          <Route path="/login" element={<LoginView />} />
          <Route path="/registro" element={<RegistroView />} />

          {/* Rutas Protegidas */}
          <Route
            path="/panel"
            element={
              <ProtectedRoute>
                <DashboardView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parcelas/nueva"
            element={
              <ProtectedRoute>
                <NuevaParcela />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parcelas/:id"
            element={
              <ProtectedRoute>
                <DetalleParcela />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
