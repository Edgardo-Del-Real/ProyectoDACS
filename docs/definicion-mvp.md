# Documento de Definición: MVP — Sistema de Apoyo a Pequeños Agricultores

> **Estado:** `v1 — sincronizado desde el documento de la cátedra (2026-10-17)`
> **Fuente original:** Google Doc compartido por la cátedra.

El objetivo del MVP es demostrar el **flujo de valor principal**: que un productor argentino
pueda registrar su campo, recibir una recomendación de siembra basada en datos reales, y ver
una simulación financiera con precios del mercado local.

---

## 1. Tema y APIs externas

**Tema:** plataforma de planificación agrícola a 5 años para pequeños productores argentinos
(1 a 10 ha). Combina clima, precios de mercado y rotación de cultivos para recomendar qué
sembrar, anticipar riesgos y simular rentabilidad.

**API externa principal (requisito de la consigna):** Open-Meteo. Es pública, gratuita y no
requiere API key. Se usa para pronóstico por coordenadas, histórico y alertas de heladas y
estrés hídrico.

### APIs complementarias

| Prioridad | API | Uso | Riesgo principal | Mitigación |
|-----------|-----|-----|------------------|------------|
| 1 | Open-Meteo | Pronóstico, histórico, alertas | Caída o límite de consultas | Caché con TTL, reintentos, último dato válido |
| 2 | Leaflet + Geoman + tiles satelitales | Dibujar el polígono de la parcela | Términos de uso del proveedor de tiles | Atribución correcta, tiles de Esri World Imagery u otro |
| 3 | AgroMonitoring (fase 2) | NDVI histórico como indicador indirecto de productividad | Límite de área y frecuencia, nubosidad | Caché de resultados, uso solo en fase 2 |
| Apoyo | API BCRA (tipo de cambio) | Conversión en simulaciones | Disponibilidad | Valor configurable de respaldo |

### APIs seleccionadas — el "por qué SÍ"

- **AgroMonitoring:** seleccionada para el análisis de suelo sin hardware. Permite enviar un
  polígono geográfico y devuelve el Índice de Vegetación (NDVI) satelital. Es indispensable
  para que el algoritmo de Rotación tenga un dato técnico real sobre el desgaste de la parcela.
- **Open-Meteo:** seleccionada por su precisión hiperlocal basada en coordenadas
  (latitud/longitud) y su plan gratuito. Es esencial para cruzar la ubicación de la parcela con
  alertas tempranas de heladas (temperatura) y estrés hídrico (precipitaciones).
- **Leaflet + OpenStreetMap:** elegida por ser 100% open-source. Permite la renderización de
  mapas satelitales en el navegador sin riesgo de bloqueos por facturación, vital para el
  registro del polígono de la parcela.
- **Scraping Bolsa de Cereales:** es la única forma de tener los precios reales que le importan
  al productor argentino (Precio Pizarra Rosario/Buenos Aires). Válido para el TP si se
  programa un worker que lea la tabla una vez al día.

### APIs descartadas — el "por qué NO"

- **Commodities API:** devuelve precios internacionales (Bolsa de Chicago). Generaría
  simulaciones de rentabilidad falsas para el productor argentino, ya que no contempla
  retenciones ni el tipo de cambio local.
- **FAOSTAT API:** datos con hasta dos años de retraso y promedios nacionales. Sirve para
  análisis macroeconómicos académicos, inútil para la campaña agrícola actual.
- **REST Countries:** el dominio del negocio está 100% acotado a Argentina. Añade latencia,
  puntos de fallo y complejidad innecesaria.

---

## 2. Requisitos Funcionales del MVP

### 2.1 Alcance del MVP

**Incluido:** registro y login, alta de parcelas con mapa, clima de la parcela, precios de
futuros, recomendación de cultivo con rotación básica y alertas de helada por email.

**Fuera del MVP (fase posterior):** simulación a 1-3-5 años, reportes PDF, NDVI,
planificación conjunta de cooperativas.

### 2.2 Épicas

| Épica | Contenido |
|-------|-----------|
| E1 Usuarios | Registro, login, perfiles por rol |
| E2 Parcelas | Alta con polígono, historial de cultivos |
| E3 Clima | Pronóstico, histórico, alertas |
| E4 Mercado | Precios de futuros y tendencia |
| E5 Recomendación | Cultivo sugerido y rotación |
| E6 Simulación | Escenarios de rentabilidad (fase 2) |
| E7 Reportes | PDF ejecutivo (fase 2) |

### 2.3 Historias de usuario con criterios de aceptación

| ID | Historia de usuario | Criterios de aceptación | Microservicios |
|----|---------------------|-------------------------|----------------|
| **US-01** | Como pequeño productor **quiero** delimitar mi campo en un mapa **para** que el sistema conozca la ubicación y tamaño exacto de mi siembra. | 1. Dado que estoy autenticado, cuando abro "Nueva parcela", entonces se carga el mapa satelital.<br>2. Dado que el mapa está cargado, cuando marco puntos y cierro la figura, entonces se forma un polígono.<br>3. Dado que cerré el polígono, cuando termino de dibujarlo, entonces el sistema calcula y muestra las hectáreas totales.<br>4. Dado un polígono válido, cuando presiono Guardar, entonces las coordenadas se almacenan vinculadas a mi usuario.<br>5. Dado un polígono con menos de 3 puntos o lados cruzados, cuando intento guardarlo, entonces el sistema muestra un error de geometría inválida. | Usuarios, Parcelas, Frontend (Leaflet) |
| **US-02** | Como agricultor, cooperativa o técnico **quiero** registrarme eligiendo mi rol **para** acceder a la plataforma con un perfil acorde a mi actividad. | 1. Dado que no tengo cuenta, cuando completo nombre, email, contraseña y rol, entonces el sistema crea mi cuenta y me lleva al login.<br>2. Dado que ya existe una cuenta con mi email, cuando intento registrarme, entonces el sistema informa que el email ya está registrado.<br>3. Dado que ingreso una contraseña de menos de 8 caracteres, entonces el sistema rechaza el registro e indica los requisitos.<br>4. Dado que se creó mi cuenta, entonces la contraseña queda almacenada con hash y nunca en texto plano. | Usuarios, API Gateway, Frontend |
| **US-03** | Como usuario registrado **quiero** iniciar sesión de forma segura **para** consultar y gestionar solo mi información. | 1. Dado que tengo una cuenta, cuando ingreso email y contraseña correctos, entonces recibo un token JWT con expiración y accedo al panel.<br>2. Dado que ingreso credenciales incorrectas, entonces el sistema responde 401 sin indicar cuál de los datos falló.<br>3. Dado que mi token expiró, cuando consulto una ruta protegida, entonces el sistema me pide iniciar sesión.<br>4. Dado que la parcela es de otro usuario, cuando intento consultarla, entonces el sistema responde 403. | Usuarios, API Gateway |
| **US-04** | Como pequeño productor **quiero** registrar qué cultivé en cada campaña en mi parcela **para** que el sistema tenga en cuenta mi historial al recomendar y rotar. | 1. Dado que tengo una parcela creada, cuando registro un cultivo con su campaña (ej. soja 2024/2025), entonces queda guardado en el historial.<br>2. Dado que el historial tiene cultivos, cuando abro el detalle de la parcela, entonces los veo ordenados por campaña.<br>3. Dado que cargué un dato por error, cuando lo edito o lo elimino, entonces el historial se actualiza. | Parcelas, Usuarios, Frontend |
| **US-05** | Como pequeño productor **quiero** ver el pronóstico del clima de mi parcela **para** decidir labores y anticipar condiciones adversas. | 1. Dado que mi parcela tiene coordenadas, cuando abro su detalle, entonces veo el pronóstico de 7 días con temperatura mínima, máxima y precipitación.<br>2. Dado que ya consulté el clima hace menos del TTL de la caché, entonces el sistema responde con el dato guardado sin llamar a Open-Meteo.<br>3. Dado que Open-Meteo no responde, entonces veo el último pronóstico guardado con la fecha de su última actualización. | Clima (Open-Meteo), Parcelas, API Gateway, Frontend |
| **US-06** | Como pequeño productor **quiero** recibir una alerta cuando se prevea una helada o una sequía **para** proteger mi cultivo con anticipación. | 1. Dado que el pronóstico marca una mínima ≤ 0 °C en las próximas 72 horas, cuando se ejecuta la verificación programada, entonces recibo un email con la parcela, la fecha y la temperatura prevista.<br>2. Dado que ya recibí la alerta para ese evento, cuando se ejecuta otra verificación, entonces no recibo un email duplicado.<br>3. Dado que la precipitación acumulada prevista queda bajo el umbral configurado, entonces recibo una alerta de estrés hídrico.<br>4. Dado que se envió una alerta, cuando abro el panel, entonces la veo registrada en mi lista de alertas. | Alertas, Clima, Parcelas, Usuarios |
| **US-07** | Como pequeño productor **quiero** consultar las cotizaciones de futuros de mis posibles cultivos **para** saber a qué precio podría vender mi cosecha. | 1. Dado que selecciono un cultivo en Mercado, cuando se carga la pantalla, entonces veo las cotizaciones por vencimiento y la fecha de última actualización.<br>2. Dado que Matba Rofex no responde, entonces veo los últimos valores guardados con un aviso de datos no actualizados.<br>3. Dado que existen precios históricos guardados, cuando pido la tendencia, entonces veo un gráfico con la evolución del precio. | Mercado (Matba Rofex), API Gateway, Frontend |
| **US-08** | Como pequeño productor **quiero** recibir una recomendación de qué cultivo sembrar en la próxima campaña **para** decidir con datos de clima, precio y rotación. | 1. Dado que mi parcela tiene historial de cultivos, cuando solicito una recomendación, entonces el sistema sugiere un cultivo que respeta la rotación.<br>2. Dado que se generó la recomendación, entonces se muestra el motivo, el clima esperado y el precio de referencia utilizados.<br>3. Dado que mi parcela no tiene historial, entonces el sistema recomienda según clima y precio y me sugiere cargar el historial.<br>4. Dado que Clima o Mercado no están disponibles, entonces el sistema usa los últimos datos guardados e indica su antigüedad. | Recomendación, Clima, Mercado, Rotación, Parcelas |
| **US-09** | Como pequeño productor **quiero** ver una secuencia de cultivos sugerida a varios años **para** mantener la fertilidad de mi suelo. | 1. Dado que mi parcela tiene historial, cuando pido el plan de rotación, entonces veo una secuencia de cultivos para las próximas campañas.<br>2. Dado que un cultivo pertenece a la misma familia botánica que el anterior, entonces no se lo propone antes de los años de espera definidos en la regla.<br>3. Dado que veo cada cultivo sugerido, cuando abro su detalle, entonces se explica el efecto esperado sobre el suelo. | Rotación, Parcelas, Recomendación |
| **US-10** *(fase 2)* | Como pequeño productor **quiero** simular escenarios cambiando cultivo, inversión o clima **para** elegir la opción más rentable a 1, 3 o 5 años. | 1. Dado que tengo una parcela con superficie definida, cuando simulo dos cultivos con un horizonte de 3 años, entonces veo el margen bruto estimado de cada uno.<br>2. Dado que se ejecuta la simulación, entonces se incluyen retenciones y tipo de cambio vigentes.<br>3. Dado que cambio un supuesto (ej. clima más seco), entonces el resultado se actualiza y puedo compararlo con el anterior. | Simulación, Mercado, Recomendación, Parcelas |
| **US-11** *(fase 2)* | Como técnico extensionista **quiero** descargar un informe en PDF con la planificación y proyecciones **para** respaldar mi asesoramiento con datos. | 1. Dado que existe una recomendación generada, cuando presiono Descargar informe, entonces obtengo un PDF con la planificación y las proyecciones.<br>2. Dado que el informe se genera, entonces incluye parcela, cultivo sugerido, rotación, clima y precios considerados.<br>3. Dado que la parcela no es mía ni de un productor asociado a mí, entonces el sistema responde 403. | Reportes, Recomendación, Simulación, Usuarios |

### 2.4 Prototipos de pantallas

| Pantalla | Contenido |
|----------|-----------|
| P1 Login / Registro | Email, contraseña, selector de rol, enlace entre ambas vistas |
| P2 Panel principal | Lista de parcelas como tarjetas, alertas activas, botón "Nueva parcela" |
| P3 Nueva parcela | Mapa satelital con herramienta de dibujo, campo nombre, superficie calculada, botón Guardar |
| P4 Detalle de parcela | Mapa pequeño, pronóstico 7 días, historial de cultivos, botón "Pedir recomendación" |
| P5 Mercado | Selector de cultivo, tabla de futuros por vencimiento, gráfico de tendencia |
| P6 Recomendación | Cultivo sugerido, motivo, rotación propuesta, clima y precio considerados |
| P7 Simulación *(fase 2)* | Formulario de escenario, gráfico comparativo a 1-3-5 años |

---

## 3. Requisitos No Funcionales del MVP

| ID | Categoría | Requisito |
|----|-----------|-----------|
| RNF-01 | Seguridad | Toda comunicación cliente-servidor debe usar HTTPS (TLS 1.2 o superior). |
| RNF-02 | Seguridad | Autenticación con JWT de expiración corta; contraseñas con hash bcrypt o Argon2. |
| RNF-03 | Seguridad | Autorización por rol y por propietario: un usuario solo accede a sus parcelas. |
| RNF-04 | Seguridad | Los microservicios no se exponen directamente; solo el API Gateway es accesible desde afuera. |
| RNF-05 | Seguridad | Credenciales y claves de APIs externas en variables de entorno, nunca en el repositorio. |
| RNF-06 | Seguridad | Validación de entradas y CORS restringido al dominio del frontend. |
| RNF-07 | Rendimiento | Respuestas del Gateway en menos de 2 segundos para datos en caché. |
| RNF-08 | Rendimiento | Caché del clima con TTL (3 horas para pronóstico, 24 horas para histórico). |
| RNF-09 | Disponibilidad | Si una API externa falla, el sistema sirve el último dato válido y lo indica en la respuesta. |
| RNF-10 | Resiliencia | Timeouts, reintentos con espera creciente y circuit breaker en llamadas a APIs externas. |
| RNF-11 | Escalabilidad | Microservicios sin estado, desplegables de forma independiente en contenedores. |
| RNF-12 | Mantenibilidad | Cada servicio con su propia base de datos o esquema; comunicación por API REST documentada con OpenAPI. |
| RNF-13 | Despliegue | Todo el entorno se levanta con Docker Compose con un solo comando. |
| RNF-14 | Calidad | Pruebas unitarias en lógica crítica y pipeline de CI con ejecución de tests. |
| RNF-15 | Usabilidad | Interfaz responsive, utilizable desde celular, en español y con lenguaje simple. |
| RNF-16 | Observabilidad | Logs estructurados y endpoint de salud (`/health`) en cada servicio. |
| RNF-17 | Cumplimiento | Atribución de fuentes de datos y mapas según los términos de cada proveedor; tratamiento de datos personales conforme a la Ley 25.326. |

---

## 4. Modelado de dominio

### Entidades principales y dueños

| Entidad | Microservicio dueño |
|---------|---------------------|
| Usuario, Cooperativa | Usuarios |
| Parcela, CampaniaCultivo | Parcelas |
| PronosticoClima | Clima |
| PrecioMercado | Mercado |
| Alerta | Alertas |
| Cultivo, ReglaRotacion | Rotación (catálogo semilla) |
| ParametroEconomico | Simulación (catálogo semilla) |

### Notas del modelo

- **Rol** puede ser `Agricultor`, `Cooperativa` o `Técnico`. **TipoAlerta** puede ser
  `Helada`, `Sequía`, `Siembra`, `Cosecha` o `Precio`.
- Entre servicios se referencian solo por `id`, **sin claves foráneas cruzadas**.
- Para la geometría de `Parcela`: PostgreSQL con PostGIS o GeoJSON en campo `Json` +
  superficie calculada con librería (decisión D2 en [`decisiones.md`](./decisiones.md)).
- Los catálogos `Cultivo`, `ReglaRotacion` y `ParametroEconomico` se cargan con datos semilla.

> ⚠️ **Gap identificado:** el schema actual de Prisma tiene `cultivoAnterior: String?` en
> `Parcela`. Esto es insuficiente para US-04. Hay que agregar el modelo `CampaniaCultivo`
> (parcela, cultivo, campana, rendimiento) antes de arrancar la Fase 1.

---

## 5. Plan de desarrollo

### 5.1 Evaluación de dificultad por servicio

| Servicio | Dificultad | Por qué | Depende de | Perfil sugerido |
|----------|-----------|---------|------------|-----------------|
| Usuarios | Media-baja | CRUD + JWT + roles. Crítico para todo lo demás. | Nada | Base sólida en seguridad web |
| API Gateway | Media | Enrutado, validación JWT, CORS, HTTPS. Poco código, mucha configuración. | Usuarios | Infraestructura y redes |
| Parcelas | Media | Geometría (GeoJSON, superficie), ownership e historial. Integra con Leaflet. | Usuarios | Backend con interés en datos geoespaciales |
| Clima | Media | Consumo de Open-Meteo, caché, resiliencia y modelo de datos de pronóstico. | Parcelas (coordenadas) | Backend con experiencia en APIs externas |
| Mercado | Media-alta | Autenticación en Remarkets, formato de contratos, fallback y proveedor intercambiable. Riesgo por entorno de pruebas. | Nada | Backend con experiencia; hacer PoC de la API cuanto antes |
| Rotación | Media | Motor de reglas por familia botánica y años de espera. La dificultad real es el conocimiento agronómico. | Catálogo de cultivos | Integrante analítico; consultar con técnico agropecuario |
| Recomendación | **Alta** | Combina clima, precio, rotación y parámetros económicos en un puntaje explicable. Depende de todos los datos. | Clima, Mercado, Rotación, Parcelas | El integrante más fuerte en lógica; arrancar con modelo de reglas ponderadas |
| Alertas | Media | Job programado, umbrales, email y deduplicación. | Clima, Usuarios | Backend con experiencia en tareas programadas |
| Simulación | **Alta** | Modelo financiero a 1-3-5 años con retenciones, tipo de cambio y escenarios. | Recomendación, Mercado | Buen manejo de matemática; **fase 2** |
| Reportes | Media-baja | Generación de PDF con plantilla. Bajo riesgo, depende de datos terminados. | Recomendación, Simulación | Quien termine antes; **fase 2** |
| Frontend | Media-alta | Mapa con dibujo de polígonos, paneles, gráficos y consumo del Gateway. Concentra mucho trabajo visible. | Gateway | 1 o 2 integrantes dedicados |
| Infraestructura | Media | Docker Compose, HTTPS, variables de entorno, CI. Transversal. | Todos | Rol compartido con Gateway |

### 5.2 Fases de trabajo

**Fase 0 — Preparación**
- Cerrar este documento y cargarlo en Jira con las épicas e historias.
- Definir stack común, convenciones, estructura de repositorios y contrato de comunicación entre servicios (OpenAPI).
- Armar el entorno base con Docker Compose y una base de datos por servicio.
- Pruebas de concepto en paralelo: llamada a Open-Meteo, autenticación en Matba Rofex Remarkets y mapa con Geoman. Si Remarkets falla, decidir ya el plan B con CSV.

**Fase 1 — Núcleo**
- Usuarios, API Gateway, Parcelas, Clima y frontend base (login, panel, alta de parcela, clima).
- **Entregable:** un usuario se registra, dibuja su parcela y ve su pronóstico. Es el flujo central y el MVP mínimo defendible.

**Fase 2 — Inteligencia**
- Mercado, Rotación y Recomendación, más la pantalla de recomendación.
- **Entregable:** la app sugiere un cultivo con motivo, rotación y precio de referencia.
- Recomendación empieza con datos simulados de Clima y Mercado para no quedar bloqueada.

**Fase 3 — Anticipación**
- Alertas por email (helada y sequía) y pulido de la integración completa.

**Fase 4 — Ampliación** *(si da el tiempo)*
- Simulación, Reportes PDF y NDVI con AgroMonitoring.

### 5.3 Asignación del equipo

- Quien tome **Recomendación** (la pieza más difícil) debería arrancar en Fase 1 colaborando en Parcelas o Clima para conocer los datos que luego va a consumir.
- Quien tome **Simulación** puede investigar costos, retenciones y estructura de márgenes durante la Fase 1 y programar en la Fase 4.
- Los servicios de dificultad Media-alta o Alta (**Mercado** y **Recomendación**) no deberían caer en la misma persona.
- Evitar que una sola persona sea dueña de Gateway, Infraestructura y Frontend a la vez: es el cuello de botella más común.
- Cada servicio tiene un **responsable principal y un revisor**. Los pull requests cruzados reparten el conocimiento.

### 5.4 Organización en Jira

- **Épicas:** E1 a E7 más Infraestructura y Frontend.
- **Historias:** US-01 a US-11 con los criterios Gherkin en la descripción.
- **Tareas técnicas por servicio:** modelo de datos, endpoints, integración externa, pruebas, Dockerfile.
- **Sprints:** uno por fase, con definición de terminado (código revisado, tests pasando, endpoint documentado en OpenAPI).

### 5.5 Riesgos principales

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Remarkets limitado o sin acceso | Mercado y Recomendación bloqueados | Prueba de concepto en la semana 1 y proveedor mock por CSV |
| Demasiados microservicios para el tiempo | Entrega incompleta | Recortar a Fase 1 y 2 como MVP; el resto queda como evolución |
| Reglas de rotación poco fundamentadas | Recomendación cuestionable | Consultar un técnico agropecuario o fuentes del INTA y documentar la fuente |
| Integración tardía | Servicios que no encajan | Contratos OpenAPI desde la Fase 0 y despliegue conjunto semanal |
| Cuello de botella en una persona | Retrasos | Revisores cruzados y documentación mínima por servicio |
