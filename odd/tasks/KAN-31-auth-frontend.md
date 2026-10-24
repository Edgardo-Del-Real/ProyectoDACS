# Tarea: KAN-31 - Wire de autenticación real: pantallas Login/Registro (FE de US-02/US-03)

## 1. Contexto y Objetivos
- **Ticket Jira:** `KAN-31` (Épica `E9 — Frontend Base`)
- **Historias de Usuario cubiertas:** US-02 (Registro de usuario) y US-03 (Inicio de sesión)
- **Problema actual:** `AuthProvider.tsx` actualmente utiliza credenciales y tokens mockeados en memoria (`mock-jwt-token`, `demo-agricultor-1`). Los botones de login en el Navbar y Home disparan este mock sin interactuar con los endpoints reales del BFF.
- **Objetivo:** Conectar el frontend a los endpoints reales de autenticación del BFF (`POST /api/auth/register` y `POST /api/auth/login`), proveer vistas dedicadas para Login y Registro con validación de formularios, feedback de error y redirección post-autenticación, y proteger rutas privadas mediante un componente `ProtectedRoute`.

## 2. Contrato de la API (BFF)
- `POST /api/auth/register`:
  - Body: `{ email: string, password: string, nombre?: string, rol?: 'AGRICULTOR' | 'COOPERATIVA' | 'TECNICO' }`
  - Requisitos: email válido, contraseña >= 8 caracteres.
  - Respuestas: 201 Created `{ message, user }` o 409 Conflict `{ error, message }` si el email ya existe.
- `POST /api/auth/login`:
  - Body: `{ email: string, password: string }`
  - Respuestas: 200 OK `{ token, user: { id, email, nombre, rol } }` o 401 Unauthorized `{ error, message }`.
- `GET /api/auth/me`:
  - Header: `Authorization: Bearer <token>`
  - Respuestas: 200 OK `{ user }` o 401/404.

## 3. Componentes a Implementar / Modificar
1. **`src/context/auth-context.ts`**:
   - Actualizar tipos de `login(credentials)` y `register(data)` retornando `Promise<void>`.
   - Soporte para estado de error y limpieza de sesión.
2. **`src/context/AuthProvider.tsx`**:
   - Implementar llamadas reales con `fetch` a `${VITE_API_URL}/api/auth/login` y `register`.
   - Persistir JWT en `localStorage` (`dacs_token`, `token`) y perfil de usuario (`dacs_user`).
   - Cierre de sesión limpiando almacenamiento local.
3. **`src/views/LoginView.tsx`**:
   - Formulario de inicio de sesión con email y contraseña.
   - Mensajes de error claros (ej: "Credenciales inválidas").
   - Redirección al panel o a la URL previa.
4. **`src/views/RegistroView.tsx`**:
   - Formulario de registro con nombre, email, contraseña (validación >= 8 caracteres) y rol (selector).
   - Manejo de error 409 ("El correo ya está registrado").
   - Autologin o redirección tras registro exitoso.
5. **`src/components/auth/ProtectedRoute.tsx`**:
   - Guard para proteger rutas como `/panel`, `/parcelas/nueva` y `/parcelas/:id`.
6. **`src/router.tsx`**:
   - Registrar rutas `/login` y `/registro`.
   - Proteger rutas privadas con `ProtectedRoute`.
7. **`src/components/layout/Navbar.tsx` & `src/views/HomeView.tsx`**:
   - Reemplazar botones mock por enlaces `<Link to="/login">` y `<Link to="/registro">`.

## 4. Criterios de Aceptación
- [ ] El usuario puede registrarse con nombre, correo, contraseña (mínimo 8 caracteres) y rol.
- [ ] Si el correo ya existe, se muestra un mensaje de advertencia adecuado (409 Conflict).
- [ ] El usuario puede iniciar sesión con correo y contraseña válidos, obteniendo un token JWT real.
- [ ] Credenciales incorrectas muestran un mensaje de error sin romper la app (401).
- [ ] Tras iniciar sesión, el usuario es redirigido a `/panel` y ve su nombre/rol en la barra de navegación.
- [ ] Al hacer click en "Cerrar sesión", el token se elimina y el usuario vuelve al estado no autenticado.
- [ ] Linting y typechecking pasan con 0 errores en `apps/frontend`.
