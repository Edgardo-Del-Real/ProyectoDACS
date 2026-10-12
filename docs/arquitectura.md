# Arquitectura

> **Estado:** propuesta inicial a validar. Registra las decisiones ya tomadas por el equipo
> y las que quedan abiertas. **Última actualización:** 2026-10-11

---

## 1. Decisiones tomadas

- **Monorepo:** este repositorio contiene el **sistema completo** (frontend + BFF + microservicios),
  no solo el cliente.
- **Docker:** todos los servicios se orquestan con **Docker** (Docker Compose).
- **BFF (Backend For Frontend):** el frontend **no** habla directo con los microservicios; habla
  contra un BFF.
- **Stack:** **Node + TypeScript**, tanto para el BFF como para los microservicios (reutiliza
  lenguaje, tipos y tooling con el frontend).
- **Deploy:** **no** se despliega con GitHub Pages (descartado).
- **BFF framework:** **Fastify** (ver [`decisiones.md`](./decisiones.md) D1, reversible si la cátedra exige otro).
- **DB:** **Postgres + PostGIS** y mensajería **RabbitMQ** para jobs async (ver `decisiones.md` D2-D3).

---

## 2. Por qué un BFF

El frontend es una SPA; si hablara directo con cada microservicio tendríamos estos problemas:

- Una sola pantalla terminaría disparando **N requests** (parcela + precio + alerta + …).
- El cliente conocería la **topología interna** y quedaría **acoplado** a cada servicio.
- Cosas transversales (sesión/auth, CORS, cache, agregación) tendrían que resolverse en el browser.

El BFF resuelve esto: es la **única API que consume el frontend** y se encarga de:

1. **Agregar/componer** llamadas a varios microservicios en una sola respuesta apta para la UI.
2. **Aislar** al frontend de cambios en los microservicios (contrato único).
3. **Centralizar** sesión/auth, CORS, cache y manejo de errores del lado servidor.

El contrato con el frontend es una sola URL base: `VITE_API_URL` → **BFF**.

---

## 3. Componentes

| Componente | Rol |
| ---------- | --- |
| **Frontend (SPA)** | React 19 + Vite 8 + TS. Es el código que hoy está en la **raíz** del repo. |
| **BFF** | Única API expuesta al navegador. Compone y adapta respuestas para la UI. |
| **Microservicios de dominio** | Usuarios, Parcelas, Mercado, Simulación, Rotación, Clima, Alertas. |
| **Integraciones externas** | Matba Rofex/Remarkets, AgroMonitoring, Open-Meteo, scraping Bolsa de Cereales (worker 1×/día). |
| **Persistencia** | Por definir (ver §6). |

> Los microservicios y el BFF viven **dentro** de la red de Docker; sólo el BFF (y el frontend en
> desarrollo) quedan expuestos.

---

## 4. Flujo de una request (ejemplo: US-03 — simular rentabilidad)

```
Navegador ──▶ BFF  /api/simulacion (parcelaId, cultivo, rinde)
                 ├─▶ Parcelas   → hectáreas de la parcela
                 ├─▶ Mercado    → precio futuro del cultivo
                 └─▶ Simulación → Ha × Rinde × Precio
       ◀── respuesta ya compuesta para la UI
```

El frontend hace **una** llamada; el BFF orquesta los microservicios.

---

## 5. Estructura del monorepo

```
ProyectoDACS/
├── apps/
│   ├── frontend/          # ✅ SPA React + Vite (ya movido desde la raíz)
│   └── bff/               # ⬜ Backend For Frontend (pendiente)
├── services/              # ⬜ microservicios de dominio (pendiente)
│   ├── usuarios/
│   ├── parcelas/
│   ├── mercado/
│   ├── simulacion/
│   ├── rotacion/
│   ├── clima/
│   └── alertas/
├── packages/              # ⬜ código compartido: contratos/tipos, config, cliente HTTP
├── docker/                # ⬜ Dockerfiles y configuración
├── docker-compose.yml     # ⬜ orquestación de todos los servicios
├── package.json           # ✅ raíz de workspaces (npm workspaces)
└── docs/
```

**Hecho:** la raíz ya es un workspace de npm (`workspaces: apps/*, services/*, packages/*`) y el
frontend se movió a `apps/frontend/`. Paths `services/*` y `packages/*` ya están declarados, así
que los próximos servicios entran sin tocar la config.

---

## 6. Decisiones abiertas

1. **Framework del BFF y de los microservicios** (el lenguaje ya está: Node + TS). Candidatos:
   Fastify o NestJS para el BFF.
2. **Motor de base de datos** y **modelo de datos** (no existen todavía).
3. **Comunicación entre servicios:** REST/HTTP vs. mensajería; y descubrimiento dentro de Docker
   (nombres de servicio de Compose).
4. **Alcance de cada microservicio:** ¿7 servicios separados o algunos agrupados?
   *Rotación*, *Clima* y *Alertas* podrían ser capacidades de un servicio mayor.
5. **Estrategia de datos de mercado (US-02):** Remarkets, scraping o ambos.
6. **Naming del workspace frontend:** sigue llamándose `dacs-showcase` (¿renombrar a
   `@proyectodacs/frontend`?).
