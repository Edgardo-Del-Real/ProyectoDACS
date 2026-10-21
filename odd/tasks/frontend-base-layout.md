# Base del Frontend + Layout — ProyectoDACS
Objetivo: Configurar base de la SPA (React 19 + Vite 8), ruteo con react-router-dom, Tailwind CSS para estilos y App Shell/Layout responsive preparado para Auth (Keycloak). Branch: feature/frontend-base-layout. Delivery: single-pr. Test runner: npm.

## Specs
- S1 (Vite base): Actualizar `apps/frontend/vite.config.ts` para usar `base: '/'` eliminando la referencia residual de GitHub Pages.
- S2 (Estilos D6): Configurar Tailwind CSS y PostCSS en `apps/frontend` respetando la decisión D6.
- S3 (Ruteo SPA): Instalar `react-router-dom` y configurar el enrutador en `apps/frontend/src/router.tsx` con rutas `/` (Inicio/Bienvenida) y `/panel` (Panel principal).
- S4 (App Shell / Layout): Crear componente `MainLayout` con Navbar responsive (branding de la plataforma, links de navegación, slot de sesión) y Footer institucional.
- S5 (Auth State Ready): Proveer un `AuthContext` ligero que abstraiga la autenticación (usuario, estado, funciones login/logout) listo para ser conectado al cliente de Keycloak.

## Tasks
- T1 (S1): Limpiar `base` en `apps/frontend/vite.config.ts` — route: inline — status: completed — commit: pending
- T2 (S2, S3): Actualizar dependencias en `apps/frontend/package.json` (`react-router-dom`, `tailwindcss`, `postcss`) — route: inline — status: completed — commit: pending
- T3 (S5): Crear `AuthContext` en `apps/frontend/src/context/AuthContext.tsx` — route: inline — status: completed — commit: pending
- T4 (S4): Crear componentes de Layout (`Navbar`, `Footer`, `MainLayout`) en `apps/frontend/src/components/layout/` — route: inline — status: completed — commit: pending
- T5 (S3): Crear vistas iniciales (`HomeView`, `DashboardView`) y configurar `Router` en `apps/frontend/src/` — route: inline — status: completed — commit: pending
- T6: Verificación y commit en branch `feature/frontend-base-layout` — route: inline — status: completed — commit: pending

## Log
- L1 (2026-10-21): Inicio de frontend-base-layout. Se alinea con el requerimiento de Keycloak: el frontend orquesta la sesión vía OIDC sin formularios locales redundantes.
