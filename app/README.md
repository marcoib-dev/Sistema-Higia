# Monitor de Salud para Hábitats (nombre por definir)

Prototipo para el NASA Space Apps Challenge 2026: *Create Health Monitoring Software for Astronauts*.

## Documentos de referencia (no están en el repo)

Las reglas citan anexos de dos documentos que **no se suben a git**. Pídeselos al equipo y ponlos en la raíz del repo (junto a `app/`):

- `NASA Space Apps Challenge Sistema Autónomo de Monitoreo de Salud para Hábitats E.pdf`: documento de visión del proyecto.
- `DESAFIO_HEALTH_MONITOR.md`: traducción del desafío con todos sus anexos (A–G). Cuando una regla dice "Anexo F", se refiere a este archivo.

Fuente oficial del desafío: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/

## Cómo correrlo

```bash
npm install
npm run dev        # abre http://localhost:5173
npm test           # tests del núcleo
npm run build      # chequeo de tipos y build de producción
```

Demo sugerida: **Día normal** → **EVA: golpe en la estación** → cambiar de astronauta y mirar
"Mismo evento, tres perfiles" → **Descenso del ánimo** (no va a la pantalla compartida) →
**Aviso de madrugada** y cambiar la hora a 8 → activar "Conexión con el hábitat" y ver la cola de reportes.

## Arquitectura

```
Sensores / simulador / voz
          │  Lectura
          ▼
┌──────────────────── NÚCLEO AUTÓNOMO (src/core) ─────────────────────┐
│ reglas/*  → Hallazgo (qué pasa, nivel, ruta, ¿sensible?, fuente)    │
│ nucleo.ts → ¿cambió el nivel? (modo proactivo, recordatorios)       │
│ personalizador.ts → texto según el perfil                           │
│ canales.ts → pantalla del hábitat / personal / auricular / figura   │
└─────────────────────────────────────────────────────────────────────┘
          │  Mensaje                        │  Hallazgos para reporte
          ▼                                 ▼
   GUI (src/ui) + voz              Interoperabilidad (EJEMPLO): solo con conexión
```

**Regla de oro:** `src/core` no importa nada de React ni del navegador. Corre igual en el traje,
en un test o en un servidor. Todo lo que toque el mundo exterior va en `src/adaptadores`.

## Estructura y reparto por líneas de trabajo

| Línea | Carpeta | Qué hay | Pendiente |
|---|---|---|---|
| — | `src/core/tipos.ts` | **Contratos de datos.** Avisen antes de cambiarlos. | |
| **A. Detección** | `src/core/reglas/` | 8 reglas: FC, presión, SpO₂, sueño, ánimo, estrés, ejercicio, radiación | Validar umbrales con los anexos; agregar huesos, temperatura, glucemia, vestibular |
| **B. Perfil y canales** | `src/core/personalizador.ts`, `canales.ts`, `nucleo.ts` | Texto por perfil, elección de canal, sueño, sensibles, recordatorios | Perfil que aprende del uso; rutas de autogestión con guías paso a paso |
| **C. GUI** | `src/ui/` | Figura coloreada, mensajes, simulador, comparación de perfiles | Gráficos de tendencia, vistas "pantalla del hábitat" y "auricular" |
| **D. Voz e interop** | `src/adaptadores/voz`, `src/adaptadores/interop` | Web Speech API; exportación de ejemplo en formato FHIR | Reconocimiento de voz local (Vosk/whisper.cpp); más intenciones |

## Cómo agregar un riesgo

1. Crea la regla en `src/core/reglas/<area>.ts` con `definirRegla(...)`. Mira `respiratorio.ts` como ejemplo corto.
2. Indica la `fuente` (anexo o tabla del desafío). Sin fuente no hay regla.
3. Súmala a `REGLAS` en `src/core/reglas/index.ts`.
4. Agrega un escenario en `src/adaptadores/simulador/escenarios.ts` y un test en `nucleo.test.ts`.

## Advertencias

- ⚠️ Los **umbrales son provisionales**: están marcados en cada archivo de reglas y hay que validarlos con los Anexos B, C y F.
- ⚠️ El límite de radiación de 600 mSv (NASA-STD-3001) hay que **verificarlo** antes de citarlo.
- ⚠️ La capa de interoperabilidad es una **interfaz de ejemplo**, no una API real de la NASA.
- El reconocimiento de voz del navegador (Chrome) usa servidores externos. La síntesis de voz sí funciona sin conexión.
