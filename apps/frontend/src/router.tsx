import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { HomeView } from './views/HomeView';
import { DashboardView } from './views/DashboardView';
import { NuevaParcela } from './pages/NuevaParcela';
import { DetalleParcela } from './pages/DetalleParcela';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomeView />} />
          <Route path="/panel" element={<DashboardView />} />
          <Route path="/parcelas/nueva" element={<NuevaParcela />} />
          <Route path="/parcelas/:id" element={<DetalleParcela />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
