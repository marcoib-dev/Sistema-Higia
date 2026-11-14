# Higia: sistema autónomo de monitoreo de salud

Prototipo para el NASA Space Apps Challenge 2026: *Create Health Monitoring Software for Astronauts*.
Higia monitorea la salud de astronautas en hábitats permanentes (Luna, Marte), funciona sin conexión,
adapta lo que dice a cada persona y decide por qué canal y en qué momento interrumpir.

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

### Activar la IA (opcional)

Sin IA, Higia funciona completa con el intérprete local. Para activar la conversación natural y el análisis de cámara:

1. Copia `app/.env.example` como `app/.env.local` y pon tu clave: `ANTHROPIC_API_KEY=...`. Este archivo no se sube a git.
2. Reinicia `npm run dev`.
3. En la app, activa **"Conexión con el hábitat"**. La IA solo se usa con conexión: representa la computadora del hábitat.

La IA solo existe con `npm run dev`, porque el servidor de desarrollo es el que guarda la clave. Un build estático funciona en modo local.

### Demo sugerida

1. **Día normal en el hábitat**: la figura se pinta de verde.
2. **EVA: golpe en la estación**: mensaje breve por auricular. Cambia de astronauta y mira "Mismo evento, tres perfiles".
3. **Sesión de ejercicio**: 125 lpm no dispara alarma porque el contexto dice que está entrenando.
4. **Descenso del ánimo**: va a la pantalla personal, nunca a la compartida.
5. **Crisis sin respuesta**: no presiones "Estoy bien". A los 15 s Higia avisa al compañero cercano o activa la baliza.
6. **Aviso de madrugada**: queda retenido; cambia la hora a 8 y se entrega.
7. Activa **Conexión con el hábitat**: se vacía la cola de reportes y se activa la IA.
8. Para presentar, usa **Ocultar simulador**.

## Funcionalidades actuales

### 1. Modo pasivo: figura 3D

Cuerpo translúcido con órganos que se colorean solos a medida que llegan datos (`app/src/ui/FiguraCorporal3D.tsx`, con three.js).

- Cada región corresponde a uno o más sistemas: cabeza → cerebro/mente, pecho → corazón y pulmones, columna → huesos, brazos → músculos, etc.
- El color es **el peor nivel** entre los riesgos activos de ese sistema: 🟢 normal, 🔵 info, 🟡 aviso, 🔴 alerta, gris = sin datos. Las regiones en alerta laten y el corazón late siempre.
- El **aro a los pies** representa todo el cuerpo (radiación).
- Se rota arrastrando y gira sola cuando nadie la toca. Clic en una región → detalle redactado según el perfil.
- Debajo hay botones con las mismas regiones, para usar con teclado o lector de pantalla.
- Si el navegador no tiene WebGL, se muestra la figura 2D anterior.

### 2. Motor de detección

Ocho reglas, una por riesgo (`app/src/core/reglas/`). Cada una lee el historial, lo compara con la **línea base personal** cuando aplica y **tiene en cuenta el contexto**. Devuelve un *hallazgo*: nivel, explicación simple, detalle técnico, acción, guía paso a paso (en alertas), ruta, si es sensible, si puede dejar al astronauta incapacitado y de qué anexo sale.

| Riesgo | Sensor | Cómo evalúa (umbrales provisionales) |
|---|---|---|
| Frecuencia cardíaca | `frecuenciaCardiaca` | Respecto a su línea base: +15 lpm → info, +30 → aviso, ≥140 o <40 → alerta. **En ejercicio** el margen sube 60 lpm (máximo 170); **en EVA**, 30 lpm |
| Presión arterial | `presionSistolica` + `presionDiastolica` | Sistólica <90 → aviso, <80 → alerta (posible desmayo). ≥140/90 → aviso, ≥160/100 → alerta |
| Oxígeno (hipoxia) | `spo2` | <95 % → info, <92 % → aviso, <88 % → alerta (posible incapacidad) |
| Sueño | `horasSueno` | Promedio de las últimas 3 noches: <7 h → info, <6 h → aviso |
| Ánimo 🔒 | `animo` (1–10) | Caída respecto a su línea base: −2 → aviso, −4 → alerta |
| Estrés 🔒 | `estres` (0–100) | ≥60 → aviso, ≥80 → alerta (compatible con crisis de pánico) |
| Ejercicio | `minutosEjercicio` (acumulado del día) | Meta de 90 min/día: <90 → info, <45 → aviso |
| Radiación | `dosisRadiacion` (mSv acumulados) | **Tormenta solar activa**: alerta fuera del hábitat, aviso dentro. Tasa ≥1 mSv/h → alerta. Acumulado: 50 % del límite → info, 80 % → aviso, 100 % → alerta |

🔒 = sensible: solo se comunica por canales privados.

Para ahorrar energía, cuando llega una lectura **solo se evalúan las reglas que usan ese sensor**. Cuando cambia el contexto, se reevalúan todas.

### 3. Contexto y entorno

El contexto cambia cómo se interpretan los datos y cómo se entregan los mensajes:

| Dato | Valores | Para qué se usa |
|---|---|---|
| Ubicación | hábitat, EVA, rover | Canal (fuera del hábitat: auricular) y acciones específicas |
| Destino | órbita, Luna, Marte | Retardo con Tierra al escalar (Marte: entre 3 y 22 min) |
| Actividad | reposo, trabajo, ejercicio | Evita falsas alarmas de pulso durante el ejercicio |
| Clima espacial | calmo, tormenta solar | Alerta de radiación según dónde esté |
| Hora del hábitat | 0–23 | Respetar el horario de sueño |
| Pantallas y auricular | disponibles o no | Elección de canal |
| Compañero cercano | sí/no | Primer destino de una escalada (radio de proximidad, no necesita red) |
| Médico a bordo | sí/no | A quién va un reporte y si se da guía paso a paso |
| Conexión con hábitat / Tierra | sí/no | Reportes, IA y escalada |

**Cámara** (con conexión e IA): toma una foto con la webcam o permite subir una imagen. La IA describe el entorno, detecta peligros visibles (persona caída, humo, equipo suelto…) e infiere ubicación, destino y actividad **solo si se ven con claridad**. Con el botón "Aplicar al contexto" esas inferencias pasan al sistema.

### 4. Modo proactivo: cuándo habla el sistema

- **Solo habla cuando algo cambia.** Si un riesgo sigue en el mismo nivel, no repite el mensaje. Así se evita la fatiga de alarmas.
- Si el primer dato es normal, no dice nada. Si un riesgo vuelve a la normalidad, solo se actualiza la figura.
- **Recordatorios según la experiencia**, solo para avisos y alertas activos: novato cada 15 min, intermedio cada 45 min, veterano nunca.

### 5. Confirmación y escalada (estado crítico)

- Toda **alerta** muestra el botón **"Estoy bien"** con una cuenta regresiva.
- Si el astronauta no responde a tiempo, Higia **avisa a otros**: 30 s en general, **15 s** si el riesgo puede dejarlo sin capacidad de pedir ayuda (hipoxia, presión muy baja, pulso extremo).
- Destinos, del más cercano al más lejano, según lo que esté disponible:
  1. Compañero cercano (radio de proximidad)
  2. Médico de a bordo (si hay y si el astronauta no es el médico)
  3. Base más cercana (con conexión al hábitat)
  4. Control en Tierra (con conexión, indicando el retardo según el destino)
  5. Si no hay nadie al alcance: **baliza de emergencia**, que se reintenta al recuperar enlace.
- La escalada siempre interrumpe, por voz si hay auricular.

### 6. Personalización por perfil

El mismo hallazgo se redacta distinto para cada astronauta (`app/src/core/personalizador.ts`):

| Rasgo del perfil | Efecto en el mensaje |
|---|---|
| Formación médica: **médico** | Título + cifras técnicas ("Presión arterial baja. PA 86/56 mmHg.") |
| Formación médica: **básica** | Explicación simple + cifras entre paréntesis |
| Formación médica: **ninguna** | Solo la explicación simple, sin números |
| **Propenso al pánico** o tolerancia al estrés **baja** | En riesgos sensibles, texto calmado que no nombra el pánico ni el estrés |
| Experiencia **veterano** | Solo la primera oración de la acción (salvo en alertas) |
| **Ubicación** | Acción específica; por ejemplo, en EVA: "Asegura bien tu arnés y, si puedes, llama a tu compañero." |
| Canal **auricular** | Versión breve: una oración de estado + una de acción |

El panel **"Mismo evento, tres perfiles"** muestra el último aviso o alerta redactado para los tres astronautas de ejemplo.

### 7. Elección de canal según el contexto

`app/src/core/canales.ts` decide por dónde llega cada mensaje, en este orden:

1. **Normal o info** → solo la figura, sin interrumpir.
2. **Aviso durante el horario de sueño** → se retiene hasta que cambie la hora. Las **alertas siempre interrumpen**.
3. **Información sensible** → pantalla personal si está en el hábitat, si no auricular. **Nunca la pantalla compartida.** Si no hay canal privado, se retiene.
4. **Fuera del hábitat** (EVA, rover) → auricular, con mensaje breve.
5. **Dentro del hábitat** → pantalla del hábitat (con voz si es alerta); si no hay, pantalla personal; si no, auricular.
6. Sin ningún canal disponible → se retiene hasta que aparezca uno.

Cada mensaje muestra **por qué se eligió ese canal**. Los retenidos se entregan solos cuando cambia el contexto.

### 8. Rutas y médico a bordo

**No siempre hay un médico en la tripulación**, así que Higia no lo da por supuesto:

- **Autogestión:** el astronauta recibe una acción que puede hacer solo.
- **Reporte:** para riesgos que requieren evaluación externa. El hallazgo entra en una cola y se dirige así:
  - **Médico a bordo** → se le avisa a él.
  - **Sin médico, con conexión** → equipo médico de la base, o Tierra (con su retardo).
  - **Sin médico ni conexión** → "avisa a un compañero"; el reporte espera en la cola hasta reconectar.
- **Guía paso a paso:** sin médico a bordo, quien no tiene formación médica recibe una guía numerada en las alertas (hipoxia, presión, pulso, estrés).

### 9. Conversación natural (NUI) con IA híbrida

| Situación | Quién responde | Qué entiende |
|---|---|---|
| **Con conexión e IA configurada** | ✨ IA (Claude Opus 5.5, en el servidor del hábitat) | Frases libres ("anoche dormí como cinco horas y me siento cansado"). Responde breve y natural, adaptada al perfil, y **extrae los datos que mencionas** para registrarlos |
| **Sin conexión, o si la IA falla** | ⚙ Intérprete local | Palabras clave: "dormí cinco horas", "mi ánimo es 4", "hice 30 minutos de ejercicio", "¿cómo está mi presión?", "¿cómo estoy?" |

- La IA recibe el estado actual (perfil, contexto, hallazgos, últimas lecturas) **sin el nombre del astronauta**. Se le pide no diagnosticar ni inventar datos, y tratar con tacto los temas sensibles.
- Recuerda las últimas 6 vueltas de la conversación.
- **Manos libres:** tras cada respuesta hablada, el micrófono se vuelve a abrir solo. Si el astronauta habla mientras Higia habla, la interrumpe.
- Cada respuesta indica si vino de la IA o del intérprete local, y por qué falló la IA si fue el caso.

### 10. Control de voz

Barra en la cabecera:

- **⏸ / ▶** pausar y reanudar.
- **⏹** detener; también con la tecla **Esc**.
- **Volumen**, que se aplica al siguiente mensaje.
- **Voz** activada o silenciada.

La síntesis de voz funciona sin conexión. El reconocimiento de voz de Chrome usa servidores de Google, así que **todavía no es autónomo**.

### 11. Capa de interoperabilidad (EJEMPLO)

- Convierte cada hallazgo a un registro **HL7 FHIR Observation**.
- Envía el **identificador** del astronauta (`AST-01`), no su nombre.
- Solo actúa con **"Conexión con el hábitat"**. Al activarla se vacía la cola de reportes.
- Es una **interfaz de ejemplo, no una API real de la NASA**. Para conectar un sistema real basta con implementar `AdaptadorExterno`.

### 12. Simulador

Se puede ocultar con **"Ocultar simulador"** (la preferencia se recuerda en el navegador).

| Escenario | Qué demuestra |
|---|---|
| Día normal en el hábitat | Todo en verde; también sirve para volver a la normalidad |
| EVA: golpe en la estación | Estrés alto en EVA → mensaje breve por auricular, con la acción del arnés |
| Crisis sin respuesta | Hipoxia grave en EVA → escalada a los 15 s si no responde |
| Sesión de ejercicio | 125 lpm en ejercicio → sin falsa alarma |
| Descenso del ánimo | Dato sensible → canal privado |
| Tres noches durmiendo poco | Déficit de sueño acumulado → aviso, no alerta |
| Hipoxia | Alerta con reporte y guía paso a paso |
| Presión baja | Riesgo de desmayo |
| Día sin ejercicio | Contramedida para huesos y músculos |
| Tormenta solar | Clima espacial de tormenta + subida de dosis → al refugio |
| Aviso de madrugada | Aviso retenido a las 3:00; se entrega al cambiar la hora a 8 |

**Astronautas de ejemplo** (ficticios):

| Nombre | Formación médica | Experiencia | Estrés |
|---|---|---|---|
| Ana Ruiz | Médica | Veterana | Tolerancia alta |
| Luis Pérez | Ninguna | Novato | Tolerancia baja, propenso al pánico |
| Kai Tanaka | Básica | Intermedio | Tolerancia alta |

### Tests

`npm test` (21 tests) verifica los comportamientos clave:

- **Canales:** EVA → auricular, lo sensible nunca a la pantalla compartida, retención durante el sueño, las alertas interrumpen de madrugada.
- **Modo proactivo:** solo habla cuando cambia algo; recordatorios según la experiencia.
- **Personalización:** texto según el perfil.
- **Reportes:** a quién van según haya médico o conexión, y cuándo hay guía paso a paso.
- **Escalada:** confirmación, plazos, destinos, baliza y retardo según el destino.
- **Contexto:** ejercicio y tormenta solar.
- **Conversación:** el intérprete local.

## Arquitectura

Todo el código está en `app/`.

```
Sensores / simulador / voz / cámara
          │  Lectura, Contexto
          ▼
┌──────────────────── NÚCLEO AUTÓNOMO (app/src/core) ─────────────────┐
│ reglas/*  → Hallazgo (qué pasa, nivel, ruta, ¿sensible?, fuente)    │
│ nucleo.ts → ¿cambió el nivel? · recordatorios · confirmación/escala │
│ personalizador.ts → texto según el perfil                           │
│ canales.ts → pantalla del hábitat / personal / auricular / figura   │
└─────────────────────────────────────────────────────────────────────┘
          │  Mensaje                        │  Reportes            ▲ frases, fotos
          ▼                                 ▼                      │
   GUI (app/src/ui) + voz        Interoperabilidad (EJEMPLO)   IA (app/server)
                                 ── solo con conexión al hábitat ──
```

**Regla de oro:** `app/src/core` no importa nada de React, del navegador ni de la IA. Corre igual en el traje, en un test o en un servidor. Todo lo que toque el mundo exterior va en `app/src/adaptadores`. La IA está en `app/server` y siempre es opcional.

## Estructura y reparto por líneas de trabajo

| Línea | Carpeta | Qué hay | Pendiente |
|---|---|---|---|
| — | `app/src/core/tipos.ts` | **Contratos de datos.** Avisen antes de cambiarlos. | |
| **A. Detección** | `app/src/core/reglas/` | 8 reglas con contexto y guías paso a paso | Validar umbrales con los anexos; agregar huesos, temperatura, glucemia, vestibular |
| **B. Perfil, canales y escalada** | `app/src/core/personalizador.ts`, `canales.ts`, `nucleo.ts` | Texto por perfil, canal, sueño, sensibles, recordatorios, confirmación y escalada | Perfil que aprende del uso |
| **C. GUI** | `app/src/ui/` | Figura 3D, mensajes, simulador, control de voz, cámara | Gráficos de tendencia, vistas "pantalla del hábitat" y "auricular" |
| **D. Voz, IA e interop** | `app/src/adaptadores/`, `app/server/` | Web Speech API, IA híbrida (conversación + visión), FHIR de ejemplo | Reconocimiento de voz local (Vosk/whisper.cpp) |

## Cómo agregar un riesgo

1. Crea la regla en `app/src/core/reglas/<area>.ts` con `definirRegla(...)`. Mira `respiratorio.ts` como ejemplo corto.
2. Indica la `fuente` (anexo o tabla del desafío). Sin fuente no hay regla.
3. Si la alerta puede dejar al astronauta incapacitado, marca `posibleIncapacidad: true`. Agrega `pasos` para cuando no hay médico a bordo.
4. Súmala a `REGLAS` en `app/src/core/reglas/index.ts`.
5. Agrega un escenario en `app/src/adaptadores/simulador/escenarios.ts` y un test en `app/src/core/nucleo.test.ts`.

## Advertencias

- ⚠️ Los **umbrales son provisionales**: están marcados en cada archivo de reglas y hay que validarlos con los Anexos B, C y F.
- ⚠️ El límite de radiación de 600 mSv (NASA-STD-3001) hay que **verificarlo** antes de citarlo.
- ⚠️ La capa de interoperabilidad es una **interfaz de ejemplo**, no una API real de la NASA.
- ⚠️ Los plazos de escalada (30 s y 15 s) son cortos para la demo; en un sistema real se definirían con criterio médico.
- La IA envía a la API de Anthropic el estado de salud (sin nombre) y las fotos que se analizan. Cada consulta tiene costo según el uso de la clave.
- El reconocimiento de voz del navegador (Chrome) usa servidores externos. La síntesis de voz sí funciona sin conexión.
