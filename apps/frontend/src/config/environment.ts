export const environment = {
  production: import.meta.env.PROD, // Booleano automático de Vite (true en build, false en dev)
  name: import.meta.env.VITE_APP_NAME || 'development',
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
};