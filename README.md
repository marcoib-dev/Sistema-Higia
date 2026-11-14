# Monitor de Salud para Hábitats (nombre por definir)

Prototipo para el NASA Space Apps Challenge 2026: *Create Health Monitoring Software for Astronauts*.

## Documentos de referencia (no están en el repo)

Las reglas citan anexos de dos documentos que **no se suben a git**. Pídeselos al equipo y ponlos en la raíz del repo, junto a este README:

- `NASA Space Apps Challenge Sistema Autónomo de Monitoreo de Salud para Hábitats E.pdf`: documento de visión del proyecto.
- `DESAFIO_HEALTH_MONITOR.md`: traducción del desafío con todos sus anexos (A–G). Cuando una regla dice "Anexo F", se refiere a este archivo.

Fuente oficial del desafío: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/

## Cómo correrlo

```bash
cd app
npm install
npm run dev        # abre http://localhost:5173
npm test           # tests del núcleo
npm run build      # chequeo de tipos y build de producción
```

Demo sugerida: **Día normal** → **EVA: golpe en la estación** → cambiar de astronauta y mirar
"Mismo evento, tres perfiles" → **Descenso del ánimo** (no va a la pantalla compartida) →
**Aviso de madrugada** y cambiar la hora a 8 → activar "Conexión con el hábitat" y ver la cola de reportes.

## Funcionalidades actuales

### 1. Modo pasivo: figura corporal

La figura humana se colorea sola a medida que llegan datos, sin que el astronauta toque nada.

- Cada región del cuerpo corresponde a uno o más sistemas: cabeza → cerebro/mente, pecho → corazón y pulmones, columna → huesos, brazos → músculos, etc.
- El color de cada región es **el peor nivel** entre los riesgos activos de ese sistema: 🟢 normal, 🔵 info, 🟡 aviso, 🔴 alerta, gris = sin datos.
- El **halo punteado** que rodea la figura representa todo el cuerpo (radiación).
- Al hacer clic en una región se ve el detalle de sus riesgos, redactado según el perfil del astronauta.

### 2. Motor de detección

Ocho reglas, una por riesgo (`app/src/core/reglas/`). Cada una lee el historial de lecturas, lo compara con la **línea base personal** del astronauta cuando aplica y devuelve un *hallazgo*: nivel, explicación simple, detalle técnico, acción recomendada, ruta (autogestión o reporte), si es sensible y de qué anexo sale.

| Riesgo | Sensor | Cómo evalúa (umbrales provisionales) |
|---|---|---|
| Frecuencia cardíaca | `frecuenciaCardiaca` | Respecto a su línea base: +15 lpm → info, +30 → aviso. ≥140 o <40 lpm → alerta con reporte |
| Presión arterial | `presionSistolica` + `presionDiastolica` | Sistólica <90 → aviso, <80 → alerta. ≥140/90 → aviso, ≥160/100 → alerta |
| Oxígeno (hipoxia) | `spo2` | <95 % → info, <92 % → aviso, <88 % → alerta con reporte |
| Sueño | `horasSueno` | Promedio de las últimas 3 noches: <7 h → info, <6 h → aviso |
| Ánimo 🔒 | `animo` (1–10) | Caída respecto a su línea base: −2 → aviso, −4 → alerta con reporte |
| Estrés 🔒 | `estres` (0–100) | ≥60 → aviso, ≥80 → alerta (compatible con crisis de pánico) |
| Ejercicio | `minutosEjercicio` (acumulado del día) | Meta de 90 min/día: <90 → info, <45 → aviso |
| Radiación | `dosisRadiacion` (mSv acumulados) | Tasa ≥1 mSv/h → alerta de tormenta solar. Acumulado: 50 % del límite → info, 80 % → aviso, 100 % → alerta |

🔒 = sensible: solo se comunica por canales privados.

Para ahorrar energía, cuando llega una lectura **solo se evalúan las reglas que usan ese sensor**.

### 3. Modo proactivo: cuándo habla el sistema

- **Solo habla cuando algo cambia.** Si un riesgo sigue en el mismo nivel, no repite el mensaje. Así se evita la fatiga de alarmas.
- Si el primer dato de un riesgo es normal, no dice nada. Si un riesgo vuelve a la normalidad, solo se actualiza la figura, sin interrumpir.
- **Recordatorios según la experiencia**, solo para avisos y alertas que siguen activos: novato cada 15 min, intermedio cada 45 min, veterano nunca. El sistema reevalúa cada 60 segundos.

### 4. Personalización por perfil

El mismo hallazgo se redacta distinto para cada astronauta (`app/src/core/personalizador.ts`):

| Rasgo del perfil | Efecto en el mensaje |
|---|---|
| Formación médica: **médico** | Título + cifras técnicas ("Presión arterial baja. PA 86/56 mmHg.") |
| Formación médica: **básica** | Explicación simple + cifras entre paréntesis |
| Formación médica: **ninguna** | Solo la explicación simple, sin números |
| **Propenso al pánico** o tolerancia al estrés **baja** | En riesgos sensibles se usa un texto calmado, que no nombra el pánico ni el estrés |
| Experiencia **veterano** | Solo la primera oración de la acción: no se le repite el procedimiento que ya conoce (salvo en alertas) |
| **Ubicación** | La acción cambia según dónde está; por ejemplo, en EVA: "Asegura bien tu arnés y, si puedes, llama a tu compañero." |
| Canal **auricular** | Versión breve: una oración de estado + una de acción |

El panel **"Mismo evento, tres perfiles"** muestra el último aviso o alerta redactado para los tres astronautas de ejemplo, uno al lado del otro.

### 5. Elección de canal según el contexto

`app/src/core/canales.ts` decide por dónde llega cada mensaje, en este orden:

1. **Normal o info** → solo la figura, sin interrumpir.
2. **Aviso durante el horario de sueño** → se retiene y se entrega cuando cambia la hora. Las **alertas siempre interrumpen**, aunque sea de madrugada.
3. **Información sensible** → pantalla personal si está en el hábitat, si no auricular. **Nunca la pantalla compartida del hábitat.** Si no hay canal privado, se retiene.
4. **Fuera del hábitat** (EVA, rover) → auricular, con mensaje breve.
5. **Dentro del hábitat** → pantalla del hábitat (con voz si es alerta); si no hay, pantalla personal; si no, auricular.
6. Si no hay ningún canal disponible → se retiene hasta que aparezca uno.

Cada mensaje muestra **por qué se eligió ese canal**, para poder explicar las reglas en la demo. Los mensajes retenidos se entregan solos cuando cambia el contexto (por ejemplo, al despertar o al volver al hábitat).

### 6. Rutas: autogestión o reporte

- **Autogestión:** el astronauta recibe una acción que puede hacer solo (hidratarse, pausar, ajustar el sueño…).
- **Reporte:** para riesgos que requieren evaluación externa (hipoxia, presión muy baja, crisis de estrés…). El hallazgo entra en una **cola de reportes**:
  - **Con conexión al hábitat:** se envía al sistema médico (ver punto 8).
  - **Sin conexión:** el mensaje indica "avisa a un compañero" y el reporte espera en la cola hasta que vuelva la conexión.

### 7. Modo conversacional

Se puede escribir o, en Chrome, hablar con el botón 🎙. Entiende números en cifras o en palabras ("cinco").

| Tipo | Ejemplos | Qué hace |
|---|---|---|
| Registrar sueño | "Dormí cinco horas" | Registra una noche y reevalúa el riesgo de sueño |
| Registrar ánimo | "Mi ánimo es 4" | Registra el ánimo (1–10) |
| Registrar ejercicio | "Hice 30 minutos de ejercicio" | Suma los minutos al total del día |
| Consultar un dato | "¿Cómo está mi presión?", pulso, oxígeno, sueño, estrés, ánimo, ejercicio, radiación | Responde con el último hallazgo, redactado según el perfil |
| Resumen | "¿Cómo estoy?" | Lista los avisos y alertas activos |

Si la voz está activada, la respuesta también se lee en voz alta.

### 8. Capa de interoperabilidad (EJEMPLO)

- Convierte cada hallazgo a un registro con formato **HL7 FHIR Observation**, un estándar abierto de interoperabilidad clínica.
- Por privacidad, envía el **identificador** del astronauta (`AST-01`), no su nombre.
- Solo actúa con **"Conexión con el hábitat"** activada. Al activarla se vacía la cola de reportes, y el panel muestra el último registro enviado.
- Es una **interfaz de ejemplo, no una API real de la NASA**. Para conectar un sistema real basta con implementar `AdaptadorExterno`.

### 9. Simulador y controles

**Escenarios** (`app/src/adaptadores/simulador/escenarios.ts`): inyectan lecturas falsas y, si corresponde, cambian el contexto.

| Escenario | Qué demuestra |
|---|---|
| Día normal en el hábitat | Todo en verde. También sirve para volver a la normalidad |
| EVA: golpe en la estación | Estrés alto en EVA → mensaje breve por auricular, con la acción del arnés |
| Descenso del ánimo | Dato sensible → canal privado, nunca la pantalla compartida |
| Tres noches durmiendo poco | Déficit de sueño acumulado → aviso, no alerta |
| Hipoxia | Alerta con reporte |
| Presión baja | Riesgo de desmayo |
| Día sin ejercicio | Contramedida para huesos y músculos |
| Tormenta solar | Subida brusca de radiación → al refugio |
| Aviso de madrugada | Aviso retenido a las 3:00; se entrega al cambiar la hora a 8 |

**Astronautas de ejemplo** (ficticios):

| Nombre | Formación médica | Experiencia | Estrés |
|---|---|---|---|
| Ana Ruiz | Médica | Veterana | Tolerancia alta |
| Luis Pérez | Ninguna | Novato | Tolerancia baja, propenso al pánico |
| Kai Tanaka | Básica | Intermedio | Tolerancia alta |

**Contexto:** ubicación (hábitat, EVA, rover), hora del hábitat, pantallas y auricular disponibles, conexión con el hábitat y con Tierra, y un interruptor para activar o silenciar la voz.

### 10. Voz

- **Hablar:** los mensajes que van al auricular se leen en voz alta en español. Funciona sin conexión, con las voces del sistema.
- **Escuchar:** el botón 🎙 usa el reconocimiento de voz del navegador. En Chrome depende de servidores de Google, así que **todavía no es autónomo**.

### Tests

`npm test` verifica los comportamientos clave: el canal en EVA, que lo sensible no vaya a la pantalla compartida, la retención durante el sueño, que las alertas interrumpan de madrugada, que solo hable cuando cambia algo, los recordatorios por experiencia, el texto por perfil, la cola de reportes sin conexión y el modo conversacional.

## Arquitectura

Todo el código está en `app/`.

```
Sensores / simulador / voz
          │  Lectura
          ▼
┌──────────────────── NÚCLEO AUTÓNOMO (app/src/core) ─────────────────┐
│ reglas/*  → Hallazgo (qué pasa, nivel, ruta, ¿sensible?, fuente)    │
│ nucleo.ts → ¿cambió el nivel? (modo proactivo, recordatorios)       │
│ personalizador.ts → texto según el perfil                           │
│ canales.ts → pantalla del hábitat / personal / auricular / figura   │
└─────────────────────────────────────────────────────────────────────┘
          │  Mensaje                        │  Hallazgos para reporte
          ▼                                 ▼
   GUI (app/src/ui) + voz          Interoperabilidad (EJEMPLO): solo con conexión
```

**Regla de oro:** `app/src/core` no importa nada de React ni del navegador. Corre igual en el traje,
en un test o en un servidor. Todo lo que toque el mundo exterior va en `app/src/adaptadores`.

## Estructura y reparto por líneas de trabajo

| Línea | Carpeta | Qué hay | Pendiente |
|---|---|---|---|
| — | `app/src/core/tipos.ts` | **Contratos de datos.** Avisen antes de cambiarlos. | |
| **A. Detección** | `app/src/core/reglas/` | 8 reglas: FC, presión, SpO₂, sueño, ánimo, estrés, ejercicio, radiación | Validar umbrales con los anexos; agregar huesos, temperatura, glucemia, vestibular |
| **B. Perfil y canales** | `app/src/core/personalizador.ts`, `canales.ts`, `nucleo.ts` | Texto por perfil, elección de canal, sueño, sensibles, recordatorios | Perfil que aprende del uso; rutas de autogestión con guías paso a paso |
| **C. GUI** | `app/src/ui/` | Figura coloreada, mensajes, simulador, comparación de perfiles | Gráficos de tendencia, vistas "pantalla del hábitat" y "auricular" |
| **D. Voz e interop** | `app/src/adaptadores/voz`, `app/src/adaptadores/interop` | Web Speech API; exportación de ejemplo en formato FHIR | Reconocimiento de voz local (Vosk/whisper.cpp); más intenciones |

## Cómo agregar un riesgo

1. Crea la regla en `app/src/core/reglas/<area>.ts` con `definirRegla(...)`. Mira `respiratorio.ts` como ejemplo corto.
2. Indica la `fuente` (anexo o tabla del desafío). Sin fuente no hay regla.
3. Súmala a `REGLAS` en `app/src/core/reglas/index.ts`.
4. Agrega un escenario en `app/src/adaptadores/simulador/escenarios.ts` y un test en `app/src/core/nucleo.test.ts`.

## Advertencias

- ⚠️ Los **umbrales son provisionales**: están marcados en cada archivo de reglas y hay que validarlos con los Anexos B, C y F.
- ⚠️ El límite de radiación de 600 mSv (NASA-STD-3001) hay que **verificarlo** antes de citarlo.
- ⚠️ La capa de interoperabilidad es una **interfaz de ejemplo**, no una API real de la NASA.
- El reconocimiento de voz del navegador (Chrome) usa servidores externos. La síntesis de voz sí funciona sin conexión.
