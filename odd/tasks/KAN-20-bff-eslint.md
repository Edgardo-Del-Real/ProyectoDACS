# Tarea: KAN-20 - Configurar ESLint en apps/bff (Cierra GitHub Issue #9)

## 1. Contexto y Objetivos
- **Ticket Jira:** `KAN-20` (Épica `E8 — Infraestructura`)
- **GitHub Issue:** `#9: chore(bff): configurar ESLint para el workspace del BFF`
- **Problema actual:** `apps/bff` tiene definido el script `"lint": "eslint ."` en `package.json`, pero no posee archivo de configuración `eslint.config.js` ni dependencias explícitas de lint en su workspace. Si se ejecuta `npm run lint --workspace apps/bff`, falla indicando que no se encuentra la configuración de ESLint.
- **Objetivo:**
  1. Proveer `apps/bff/eslint.config.js` configurado para Node.js y TypeScript plano (sin dependencias ni plugins de React).
  2. Declarar las dependencias `eslint`, `@eslint/js`, `typescript-eslint` y `globals` en `apps/bff/package.json`.
  3. Ejecutar el linter en el workspace de BFF y corregir cualquier violación de reglas existente.
  4. Integrar el paso de lint en el workflow de CI (`.github/workflows/ci.yml`).

## 2. Configuración Propuesta
- `eslint.config.js`:
  ```javascript
  import js from '@eslint/js';
  import globals from 'globals';
  import tseslint from 'typescript-eslint';
  import { defineConfig, globalIgnores } from 'eslint/config';

  export default defineConfig([
    globalIgnores(['dist']),
    {
      files: ['**/*.ts'],
      extends: [js.configs.recommended, tseslint.configs.recommended],
      languageOptions: { globals: globals.node },
    },
  ]);
  ```

## 3. Plan de Verificación
- `npm run lint --workspace apps/bff` debe ejecutarse y salir con código 0.
- `npm run build --workspace apps/bff` debe compilar sin errores de tipo.
- El CI de GitHub debe correr el job `bff` incluyendo la etapa `Lint`.
