export const environment = {
  production: import.meta.env.PROD, // Booleano automático de Vite (true en build, false en dev)
  name: import.meta.env.VITE_APP_NAME || 'development',
  // Base SIN /api: las vistas arman las rutas como `${VITE_API_URL}/api/...`
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080',
};