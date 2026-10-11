# Documento de Definición: MVP — Sistema de Apoyo a Pequeños Agricultores

> **Estado:** `v0 — transcripción del PDF, INCOMPLETO`
> **Fuente:** `Trabajo Práctico Cliente Servidor.pdf` (Descargas). Transcripción al
> repositorio para que el equipo la tenga versionada. Todavía tiene huecos (ver
> notas al final de cada sección).

Este documento establece el alcance del Producto Mínimo Viable (MVP). El objetivo del MVP
es demostrar el **flujo de valor principal**: que un productor argentino pueda registrar su
campo, recibir una recomendación de siembra basada en datos reales, y ver una simulación
financiera con precios del mercado local.

---

## 1. Justificación Técnica de Integraciones (APIs)

Para que el sistema sea viable, escalable y útil en el contexto agropecuario argentino, la
selección de fuentes de datos se rige por criterios técnicos y de negocio.

### APIs Seleccionadas (el "por qué SÍ")

Estas integraciones forman el núcleo de datos del sistema, garantizando precisión local y
viabilidad técnica:

- **Matba Rofex (entorno Remarkets):** es el pilar financiero. Se elige sobre cualquier otra
  API porque provee las cotizaciones de **futuros agrícolas locales** (Rosario/Buenos Aires).
  Un productor necesita saber a cuánto va a vender su cosecha en mayo del año que viene,
  contemplando la realidad impositiva y cambiaria argentina, no el precio actual de Chicago.
- **AgroMonitoring API:** seleccionada para el análisis de suelo **sin hardware**. Permite
  enviar un polígono geográfico y devuelve el **Índice de Vegetación (NDVI)** satelital. Es
  indispensable para que el algoritmo de Rotación tenga un dato técnico real sobre el desgaste
  de la parcela.
- **Open-Meteo:** seleccionada por su precisión **hiperlocal** basada en coordenadas
  (latitud/longitud) y su tier gratuito. Es esencial para cruzar la ubicación de la parcela
  con alertas tempranas de **heladas** (temperatura) y **estrés hídrico** (precipitaciones).
- **Leaflet + OpenStreetMap (frontend):** elegida por ser 100% open-source. Permite la
  renderización de mapas satelitales en el navegador sin riesgo de bloqueos por facturación,
  vital para el registro del polígono de la parcela.
- **Scrapear la Bolsa de Cereales:** *(si bien no es una API, puede servir para tener los datos
  actualizados del país)*.
  - **Por qué sí:** es la única forma de tener los precios reales que le importan al productor
    argentino (Precio Pizarra Rosario/Buenos Aires).
  - **El detalle:** scrapear la Bolsa de Cereales es totalmente válido para el trabajo práctico
    si se programa un **worker que lea la tabla una vez al día**.

### APIs Descartadas (el "por qué NO")

Estas APIs fueron evaluadas y rechazadas por introducir latencia sin valor, datos
desactualizados o información ajena a la realidad nacional:

- **Commodities API:** descartada. Devuelve precios internacionales (Bolsa de Chicago).
  Utilizarla generaría simulaciones de rentabilidad **falsas** para el productor argentino, ya
  que no contempla derechos de exportación (retenciones) ni el tipo de cambio local.
- **FAOSTAT API:** descartada para el MVP. Sus datos de producción y precios tienen hasta dos
  años de retraso y son promedios nacionales. Sirve para análisis macroeconómicos académicos,
  pero es inútil para la toma de decisiones de la campaña agrícola actual.
- **REST Countries:** descartada por **ineficiencia de arquitectura**. El dominio del negocio
  está 100% acotado a Argentina. Consumir un microservicio externo para obtener la moneda,
  idioma o huso horario añade latencia a la red, puntos de fallo y complejidad innecesaria.

---

## 2. Requisitos Funcionales (RF) del MVP

Para el MVP nos centraremos en las funcionalidades que demuestran la **interacción entre los
microservicios principales**:

- **Gestión de Parcelas:** el sistema debe permitir al usuario dibujar el polígono de su
  terreno en un mapa interactivo y calcular automáticamente la superficie en hectáreas.
- **Obtención de Mercado Local:** el sistema debe consultar y almacenar **diariamente** los
  precios (soja, maíz, trigo).
- **Evaluación de Suelo:** el sistema debe consultar el índice **NDVI histórico** de la
  parcela registrada para determinar el estado de la vegetación.
- **Motor de Simulación (Core):** el sistema debe calcular el **ingreso bruto estimado**
  cruzando tres variables: hectáreas de la parcela, rinde estimado y precio de mercado.
- **Alertas Climáticas Básicas:** el sistema debe alertar al usuario si el pronóstico a 7 días
  indica temperaturas inferiores a **3 °C** (riesgo de helada) en las coordenadas de su parcela.

---

## 3. Historias de Usuario y Criterios de Aceptación

Estas historias estructuran el trabajo de desarrollo para cumplir con los requisitos
funcionales.

### US-01 — Delimitar el campo en un mapa

**Como** pequeño productor **quiero** delimitar mi campo en un mapa **para** que el sistema
conozca la ubicación y tamaño exacto de mi siembra.

**Criterios de aceptación:**

1. El mapa satelital se carga correctamente.
2. Puedo dibujar un polígono cerrando los puntos.
3. El sistema calcula y muestra las hectáreas totales.
4. Las coordenadas del polígono se guardan en la base de datos, vinculadas a mi usuario.

**Microservicios involucrados:** Usuarios, Parcelas, Frontend (Leaflet).

### US-02 — Consultar precios futuros diarios

**Como** sistema **quiero** consultar los precios futuros diarios **para** mantener la base de
datos de mercado actualizada sin depender de latencias externas en tiempo real.

**Criterios de aceptación:**

1. **(Definir cómo lo vamos a hacer).** ← *hueco pendiente en el documento*
2. Extrae los precios de ajuste de Trigo, Maíz y Soja.
3. Los guarda en la base de datos local con su fecha respectiva.

**Microservicios involucrados:** Mercado.

### US-03 — Simular la rentabilidad de sembrar soja

**Como** productor **quiero** simular la rentabilidad de sembrar soja esta campaña **para**
saber si los números me cierran antes de invertir.

**Criterios de aceptación:**

1. Ingreso el cultivo (Soja) y mi rinde estimado (ej. 30 qq/ha).
2. El sistema obtiene las hectáreas de mi parcela.
3. El sistema busca el precio futuro a mayo en la BD local.
4. El sistema muestra en pantalla el ingreso bruto proyectado (`Ha × Rinde × Precio`).

**Microservicios involucrados:** Parcelas, Mercado, Simulación.

### US-04 — Sugerencia de rotación de cultivos

**Como** productor **quiero** recibir una sugerencia de rotación **para** no degradar los
nutrientes de mi suelo.

**Criterios de aceptación:**

1. El sistema consulta el último cultivo sembrado en mi parcela.
2. El sistema envía el polígono a AgroMonitoring y lee el NDVI.
3. Si el cultivo anterior fue Soja, el sistema recomienda **obligatoriamente** una gramínea
   (ej. Maíz o Trigo) y muestra una breve justificación agronómica.

**Microservicios involucrados:** Parcelas, Rotación (AgroMonitoring).

### US-05 — Alertas climáticas críticas

**Como** productor **quiero** ver alertas climáticas críticas en mi panel **para** tomar medidas
preventivas sobre mis cultivos.

**Criterios de aceptación:**

1. El sistema envía las coordenadas de mi parcela a Open-Meteo.
2. Si en los próximos 7 días hay temperaturas ≤ 3 °C, se genera una alerta.
3. Veo una tarjeta roja de "Riesgo de Helada" al entrar a la plataforma.

**Microservicios involucrados:** Parcelas, Clima (Open-Meteo), Alertas.

---

## 4. Huecos conocidos del documento (a completar)

- **US-02, criterio 1:** dice literalmente *"(Definir cómo lo vamos a hacer)"*. Falta definir la
  estrategia de obtención de precios (Remarkets vs. scraping de la Bolsa de Cereales vs. ambos)
  y su periodicidad/worker.
- **No hay modelo de datos** (entidades Usuario, Parcela, Cultivo, PrecioMercado, Alerta…).
- **No hay decisión de stack técnico** documentada (lenguajes/frameworks de los microservicios,
  motor de base de datos, orquestación).
- **No hay diagrama de arquitectura** ni contrato de API entre microservicios.
- **No está definido el rinde estimado**: US-03 lo ingresa el usuario, pero no hay default ni
  fuente sugerida.
