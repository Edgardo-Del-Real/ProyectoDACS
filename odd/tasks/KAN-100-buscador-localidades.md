# Tarea: KAN-100 - Buscador de localidades (Nominatim) en el mapa de delimitación de parcelas

## 1. Contexto y Objetivos
- **Ticket Jira:** `KAN-100` (Épica `E2 — Parcelas`)
- **Problema actual:** Al ingresar a la pantalla de delimitación de una nueva parcela (`NuevaParcela.tsx`), el mapa satelital inicia con una vista general de Argentina (`center: [-38, -63]`, zoom 5). Para ubicar su campo, el productor debe hacer zoom y navegar manualmente por todo el país, lo cual resulta tedioso y poco intuitivo.
- **Objetivo:** Incorporar un buscador de localidades en el mapa (`MapaPoligono.tsx`) conectado a la API de geocodificación de OpenStreetMap (Nominatim), permitiendo al usuario buscar ciudades o pueblos argentinos y centrar el mapa automáticamente con animación (`flyTo`) en las coordenadas correspondientes.

## 2. Decisiones de Diseño y UX
- **Servicio:** OpenStreetMap Nominatim (`https://nominatim.openstreetmap.org/search`)
  - Parámetros: `format=json`, `countrycodes=ar`, `limit=5`, `addressdetails=1`.
  - Debounce de 400ms para respetar la política de uso de Nominatim y evitar peticiones excesivas.
  - User-Agent identificado en las peticiones.
- **Componente `BuscadorLocalidades`:**
  - Integrado dentro del contexto de Leaflet (`useMap()`), ubicado en la esquina superior derecha (`top-right`) para no interferir con los controles de dibujo de Geoman (ubicados en `top-left`).
  - Aislamiento de eventos con `L.DomEvent.disableClickPropagation` y `disableScrollPropagation` para evitar que interactuar con el buscador arrastre o haga zoom en el mapa subyacente.
  - Dropdown interactivo con lista de resultados, mostrando el nombre principal y la provincia/departamento.
  - Animación suave de desplazamiento (`map.flyTo([lat, lon], 13, { duration: 1.5 })`) al seleccionar una localidad.
  - Indicador temporal de ubicación en el mapa con popup/tooltip informativo.
  - Soporte de botón limpiar (clear) y cierre al hacer click fuera del componente.

## 3. Plan de Verificación
- `npm run lint --workspace apps/frontend`: 0 errores.
- `npm run build --workspace apps/frontend`: Compilación de producción exitosa.
- Validación funcional de búsqueda, navegación, selección y desplazamiento del mapa.
