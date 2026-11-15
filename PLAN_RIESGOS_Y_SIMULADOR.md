# Plan: cobertura completa de riesgos HRP y nuevo simulador

> **Para quien implementa (Opus 5.5).** Este documento es autosuficiente: describe qué construir, en qué archivos y en qué orden. No hay código escrito todavía.
> **Fuente de requisitos:** `D:\Proyectos de python\NASA SPACE APP\DESAFIO_HEALTH_MONITOR.md` (fuera del repo). Las referencias "§7.1.3", "Anexo F", etc. apuntan a ese documento.
> **Fecha del plan:** 14/11/2026. Estado del repo al planificar: commit `3b1a83e`, 11 reglas, 15 escenarios, 49 tests.

## Índice

1. [Objetivo y alcance](#1-objetivo-y-alcance)
2. [Diagnóstico: qué cubre hoy Higia](#2-diagnóstico-qué-cubre-hoy-higia)
3. [Decisiones de diseño](#3-decisiones-de-diseño)
4. [Parte A: cimientos del motor](#4-parte-a-cimientos-del-motor)
5. [Parte B: catálogo de datos nuevos](#5-parte-b-catálogo-de-datos-nuevos)
6. [Parte C: reglas nuevas, riesgo por riesgo](#6-parte-c-reglas-nuevas-riesgo-por-riesgo)
7. [Parte D: conversación e IA](#7-parte-d-conversación-e-ia)
8. [Parte E: motor del simulador](#8-parte-e-motor-del-simulador)
9. [Parte F: interfaz del simulador](#9-parte-f-interfaz-del-simulador)
10. [Parte G: catálogo de escenarios](#10-parte-g-catálogo-de-escenarios)
11. [Tests](#11-tests)
12. [Orden de implementación](#12-orden-de-implementación)
13. [Riesgos del plan y cosas a vigilar](#13-riesgos-del-plan-y-cosas-a-vigilar)
14. [Decisiones abiertas para el equipo](#14-decisiones-abiertas-para-el-equipo)

---

## 1. Objetivo y alcance

**Objetivo 1.** Que el motor detecte los **17 riesgos del HRP** (§7 del documento) más el riesgo adicional de **tromboembolismo venoso** (§8.2, Venous Haemostasis), y que use los dos indicadores sugeridos por la NASA que hoy tienen tipo pero no regla (**temperatura** y **glucemia**).

**Objetivo 2.** Convertir el panel "Demo" en un **simulador completo**: escenarios con línea de tiempo y narración, inyección manual de cualquier dato, control de la tripulación, matriz de cobertura de riesgos NASA y un registro que explique por qué Higia hizo lo que hizo.

**Fuera de alcance** (no implementar en este plan): rutinas y recordatorios de medición, gamificación, gráficos históricos para el astronauta, una sección "biblioteca de riesgos" en la app del astronauta, sensores reales.

**Reglas del juego que se mantienen:**

- `core/` no depende de React ni de la IA. Todo corre sin conexión.
- Cada regla declara su `fuente` (sección del documento). Sin fuente no hay regla.
- Todos los umbrales son **provisionales** y se marcan como tales en el archivo (misma convención que hoy).
- Toda alerta (`nivel: 'alerta'`) lleva `pasos`. Lo que puede dejar al astronauta sin responder lleva `posibleIncapacidad: true`.
- Salud mental y datos de convivencia son `sensible: true`.
- Cada fase termina con `npm run typecheck` y `npm test` en verde (desde `app/`).

---

## 2. Diagnóstico: qué cubre hoy Higia

| # | Riesgo HRP (§) | Hoy | Falta |
|---|---|---|---|
| 1 | Respuesta inmune alterada (7.1.1) | Nada. `temperatura` existe como tipo, sin regla | Fiebre, síntomas de piel/herpes/alergia, factores (sueño, estrés, radiación) |
| 2 | Sensoriomotor y vestibular (7.1.2) | Solo el síntoma "mareo" como alerta suelta de conversación | Cinetosis, prueba de equilibrio, transición de gravedad, bloqueo de tareas críticas |
| 3 | Adaptaciones cardiovasculares (7.1.3) | FC y PA | Arritmia, hipotensión al aterrizar, tendencia |
| 4 | Descompresión (7.1.4) | Nada | Prerrespiración, síntomas durante y después de EVA |
| 5 | Huésped-microorganismos (7.1.5) | Nada | Carga microbiana ambiental, síntomas digestivos y de piel |
| 6 | Hipoxia (7.1.6) | SpO₂ puntual | Hipoxia leve por atmósfera de cabina, cuadro de síntomas |
| 7 | Alimentación y nutrición (7.1.7) | Nada. `glucemia` existe como tipo, sin regla | Ingesta, peso, hidratación, fatiga de menú, glucemia |
| 8 | Lesiones y rendimiento en EVA (7.1.8) | FC con margen en EVA | Duración, sobreesfuerzo, aptitud previa a la EVA |
| 9 | Aptitud cardiorrespiratoria y musculoesquelética (7.1.9) | Minutos de ejercicio del día | Fuerza, aptitud aeróbica, adherencia semanal, resistencia |
| 10 | SANS (7.1.10) | Solo "visión borrosa" como alerta suelta | Agudeza visual, presión intraocular, OCT, contramedidas |
| 11 | Cambios óseos (7.1.11) | Nada (hay un TODO en `musculoesqueletico.ts`) | Pérdida estimada por día de misión, calcio urinario, antecedentes |
| 12 | Conducta y trastornos psiquiátricos (7.2.1) | Ánimo, estrés, psicosis | Ánimo bajo sostenido (tendencia) |
| 13 | Trabajo en equipo (7.2.2) | Nada | Cohesión del equipo |
| 14 | Sueño y horarios (7.2.3) | Promedio de 3 noches | Desfase circadiano, sobrecarga de trabajo |
| 15 | Soporte para operar sistemas (7.2.4) | Guías paso a paso, modo sin conexión | Garantizarlo por test: toda alerta con `pasos` |
| 16 | Cargas dinámicas (7.2.5) | Golpe en la cabeza | Carga en el cuerpo al aterrizar, dolor de columna |
| 17 | Radiación (7.3.1) | Dosis, tasa, tormenta | Proyección al límite, umbral según destino |
| + | Tromboembolismo venoso (8.2) | Nada | Flujo yugular, asimetría de pantorrilla, dolor de pierna |

**Problemas estructurales detectados al leer el código** (se arreglan en la Parte A):

1. **Hallazgos que no caducan.** En `NucleoSalud.evaluar`, si una regla devuelve `null` (por ejemplo, el golpe en la cabeza ya tiene más de 24 h) el hallazgo viejo queda para siempre en `this.hallazgos`. Con las reglas nuevas, que usan ventanas de tiempo, esto se vuelve visible.
2. **Los síntomas contados no se correlacionan.** "Me duele la cabeza" produce un hallazgo `conversacion.*` aislado; ninguna regla puede combinarlo con SpO₂ o con una EVA reciente.
3. **No se puede reiniciar.** No hay forma de limpiar el estado entre escenarios; "Día normal" no borra lo que no pisa.
4. **Los escenarios son de un solo disparo.** No pueden mostrar evolución (empeora, no responde, se recupera).
5. **Las noches del simulador están separadas por 1 ms** (`t - 2`, `t - 1`, `t`). Funciona con `ultimas(n)`, pero rompe cualquier regla por ventana de días.

---

## 3. Decisiones de diseño

| Decisión | Elegido | Por qué |
|---|---|---|
| Cómo modelar los síntomas | Como **datos** del mismo historial (`TipoSensor` con prefijo `sx`, intensidad 0–10) | Un solo flujo: trazabilidad, reglas por sensor, IA y simulador sin casos especiales. Permite reglas sindrómicas (síntoma + sensor + contexto) |
| Metadatos de cada dato | Ampliar `INFO_SENSOR` con categoría, rango y paso | El simulador genera sus controles desde ahí; la IA y la voz validan rangos desde ahí |
| Mapa a los riesgos NASA | Catálogo `core/riesgosHRP.ts` + campo `hrp` en cada regla | La matriz de cobertura y el test de cobertura salen de datos, no de texto |
| Tiempo en el simulador | **Tiempo real**, con historia precargada hacia atrás y pasos espaciados en segundos | Evita virtualizar el reloj (los plazos de escalada de 15 s y 30 s ya son parte de la demo). El "día de misión" es un dato de contexto |
| Riesgos de largo plazo (hueso, radiación) | Estimación a partir de `diaMision` + adherencia + marcadores | En vuelo no hay densitometría (Anexo F: "solo en Tierra") |
| Aptitud para tareas críticas | Los hallazgos declaran qué tareas contraindican (`bloquea`) y el núcleo lo agrega | Cubre EVA, pilotaje y cargas dinámicas sin duplicar umbrales |
| Ubicación del simulador | Panel lateral con dos tamaños + barra de reproducción fija | El jurado tiene que ver la app reaccionar mientras se opera el simulador |
| Escenarios | Datos declarativos con resultado `esperado` | El mismo catálogo sirve de demo y de suite de tests |

---

## 4. Parte A: cimientos del motor

Archivos: `app/src/core/tipos.ts`, `core/nucleo.ts`, `core/historial.ts`, `core/reglas/util.ts`, y uno nuevo `core/riesgosHRP.ts`.

### A1. Catálogo de riesgos HRP (`core/riesgosHRP.ts`, nuevo)

```ts
export type Peligro = 'radiacion' | 'aislamiento' | 'distancia' | 'gravedad' | 'entorno';
export type IdRiesgoHRP =
  | 'inmune' | 'sensoriomotor' | 'cardiovascular' | 'descompresion' | 'microorganismos' | 'hipoxia'
  | 'nutricion' | 'eva' | 'aptitud' | 'sans' | 'oseo'
  | 'conductual' | 'equipo' | 'sueno' | 'sistemas' | 'cargasDinamicas'
  | 'radiacion' | 'trombosis';
export interface RiesgoHRP {
  id: IdRiesgoHRP; nombre: string; categoria: 'fisiologia' | 'conducta' | 'radiacion';
  seccion: string;            // '7.1.3'
  peligros: Peligro[]; sistemas: SistemaCorporal[];
  resumen: string;            // una oración, lenguaje simple
  url: string;                // página de nasa.gov (§15 del documento)
}
export const RIESGOS_HRP: RiesgoHRP[] = [/* 18 entradas */];
```

`sistemas` sale del Anexo G. `peligros` sale del Anexo A y de cada ficha de §7.

### A2. Cambios en `tipos.ts`

- `INFO_SENSOR[s]` pasa a `{ nombre, unidad, categoria, min, max, paso, porVoz? }` con `categoria: 'vital' | 'sintoma' | 'prueba' | 'habito' | 'traje' | 'entorno' | 'laboratorio'`. `porVoz: true` marca lo que el astronauta puede reportar hablando.
- `Regla` gana `hrp: IdRiesgoHRP[]` (obligatorio). Completar también en las 11 reglas existentes.
- `Hallazgo` gana `hrp?: IdRiesgoHRP[]` (lo copia `definirRegla`) y `bloquea?: TareaCritica[]`, con `type TareaCritica = 'eva' | 'pilotaje' | 'ejercicioIntenso'`.
- `Contexto` gana `diaMision: number` y `transicionGravedad: boolean` (hubo un cambio de gravedad en las últimas ~72 h: llegada a la superficie o regreso). Actualizar `CONTEXTO_INICIAL` en `App.tsx` (`diaMision: 45`, `transicionGravedad: false`) y el `HABITAT` de los tests.
- Exportar `NOMBRE_PELIGRO` y `NOMBRE_TAREA` para la interfaz.

### A3. Cambios en `nucleo.ts`

1. **Caducidad de hallazgos.** En `evaluar`: si la regla devuelve `null` y existía un hallazgo con ese `riesgoId`, borrarlo de `hallazgos`, de `emitido` y de `porConfirmar`. Los `conversacion.*` y `asistente.*` no pasan por reglas: darles vencimiento propio (24 h) revisado en `tick`.
2. **`aptitudTareas(): Record<TareaCritica, { apto: boolean; motivos: Hallazgo[] }>`**: agrega los `bloquea` de los hallazgos con nivel `aviso` o superior.
3. **Aviso al iniciar una tarea contraindicada.** En `actualizarContexto`, si `cambios.ubicacion` pasa a `'eva'` o `'rover'` y `aptitudTareas()` dice no apto, generar un hallazgo sintético `tarea.eva` / `tarea.pilotaje` (nivel `aviso`, `ruta: 'reporte'`, detalle con los motivos) y pasarlo por `procesarHallazgo`. Se borra al volver al hábitat.
4. **`estadoRiesgosHRP(): Record<IdRiesgoHRP, Nivel | 'sinDatos'>`**: igual que `estadoCorporal`, agrupando por `hallazgo.hrp`.

El reinicio no va en el núcleo: lo hace la app creando un núcleo nuevo (Parte E).

### A4. Utilidades para reglas (`reglas/util.ts` e `historial.ts`)

Mover a `util.ts` los ayudantes que hoy están privados en `neuro.ts` (`recientes`, `ultimaReciente`, `datosDe`) y agregar:

- `promedioDiario(h, sensor, ahora, dias)`: promedio por día calendario (para datos con varias lecturas diarias).
- `diasCumpliendo(h, sensor, ahora, dias, predicado)`: cuántos de los últimos N días cumplen una condición.
- `pendiente(h, sensor, ahora, dias)`: tendencia por día (regresión lineal simple). Devuelve `null` con menos de 3 puntos.
- `caidaRelativa(valor, base)`.
- `factor(h, p, ahora)`: devuelve los factores de riesgo compartidos que varias reglas usan como agravante: `{ suenoBajo, estresAlto, dosisAlta }`, cada uno con su `DatoClinico`.
- `tieneAntecedente(p, sistema, patron?)`: lee `historiaClinica.antecedentes`.

En `Historial`, agregar `entre(s, desde, hasta)`.

---

## 5. Parte B: catálogo de datos nuevos

Agregar a `TipoSensor` e `INFO_SENSOR`. Los 16 existentes se conservan (completar su categoría y rango). Rangos = límites del control del simulador y de la validación de entradas.

### Signos vitales y dispositivos

| Dato | Unidad | Rango | Notas |
|---|---|---|---|
| `irregularidadRitmo` | % de latidos irregulares | 0–40 | Del monitor cardíaco |

### Síntomas reportados (intensidad 0–10, todos `porVoz`)

| Dato | Qué recoge |
|---|---|
| `sxCefalea` | Dolor de cabeza |
| `sxNauseas` | Náuseas o vómitos |
| `sxMareo` | Mareo, vértigo, desorientación espacial |
| `sxVision` | Visión borrosa o cambios de visión |
| `sxDisnea` | Falta de aire |
| `sxDolorArticular` | Dolor en articulaciones (hombros, codos, rodillas) |
| `sxNeurologico` | Hormigueo, debilidad de un lado, dificultad para hablar |
| `sxPiel` | Erupción, herpes labial, lesiones de piel |
| `sxAlergia` | Congestión, estornudos, picazón atípicos |
| `sxDigestivo` | Diarrea, dolor abdominal |
| `sxDolorEspalda` | Dolor de columna o lumbar |
| `sxDolorPierna` | Dolor o hinchazón de una pierna |
| `sxApetito` | Pérdida de apetito |

### Pruebas a bordo

| Dato | Unidad | Rango | Fuente |
|---|---|---|---|
| `equilibrio` | puntaje 0–100 | 0–100 | Pruebas sensoriomotoras (Standard Measures) |
| `fuerza` | índice 0–100 | 0–120 | Prueba de fuerza corporal total |
| `aptitudAerobica` | mL/kg/min | 15–70 | Autoevaluación de aptitud (§7.1.9) |
| `agudezaVisual` | puntaje 0–100 | 0–100 | Pruebas de visión (ISAFE) |
| `presionIntraocular` | mmHg | 5–45 | Brain Fluid Pressure |
| `grosorRetina` | µm de cambio respecto al valor previo al vuelo | −20–120 | OCT (B-Complex) |
| `flujoYugular` | grado 1–4 por ecografía | 1–4 | Venous Haemostasis. 1 normal, 2 lento, 3 estancado, 4 retrógrado o trombo sospechado |
| `asimetriaPantorrilla` | cm de diferencia entre piernas | 0–8 | Autoexamen |

### Hábitos y encuestas

| Dato | Unidad | Rango | Fuente |
|---|---|---|---|
| `caloriasDia` | kcal del día | 0–4500 | Registro diario de comidas (Food Physiology) |
| `hidratacion` | mL del día | 0–5000 | Anexo F, contramedidas |
| `pesoCorporal` | kg | 40–130 | Food Acceptability: pérdida de masa corporal |
| `aceptabilidadComida` | escala 1–9 | 1–9 | Encuesta semanal de comidas |
| `minutosResistencia` | min del día | 0–180 | §7.1.9: fuerza + aeróbico |
| `horasTrabajo` | h del día | 0–18 | §7.2.3: sobrecarga |
| `desfaseCircadiano` | h de corrimiento del sueño | 0–12 | Actigrafía |
| `cohesionEquipo` | escala 1–10 | 1–10 | Encuestas conductuales (ARCHeR) |

### Traje y vehículo

| Dato | Unidad | Rango |
|---|---|---|
| `duracionEva` | min de la EVA en curso (telemetría del traje) | 0–600 |
| `prerrespiracion` | min de oxígeno respirado antes de esta EVA | 0–300 |
| `aceleracionCuerpo` | g pico en el torso (asiento o traje) | 0–30 |

### Entorno y laboratorio

| Dato | Unidad | Rango |
|---|---|---|
| `ppO2Cabina` | kPa | 10–25 |
| `ruidoCabina` | dBA | 30–90 |
| `cargaMicrobiana` | UFC por placa (hisopado de superficie o agua) | 0–500 |
| `calcioUrinario` | mg/día | 50–500 |

**Líneas base nuevas en `perfiles.ts`** (por perfil): `fuerza`, `aptitudAerobica`, `equilibrio`, `agudezaVisual`, `pesoCorporal`, `cohesionEquipo`, `presionIntraocular`. Agregar al `Perfil` un campo `requerimientoCalorico: number` (kcal/día).

---

## 6. Parte C: reglas nuevas, riesgo por riesgo

Formato: **id** · archivo · sistema · datos que la disparan. Todos los umbrales son provisionales; los que vienen del documento lo indican. "Agravante" = sube un nivel (de info a aviso, de aviso a alerta) o baja el umbral, y el `detalleTecnico` lo nombra.

### C1. Inmune (§7.1.1) · archivo nuevo `reglas/inmune.ts`

**`inmune.fiebre`** · sistema `inmune` · `temperatura`
- ≥37,5 °C info; ≥38 aviso; ≥39 o ≥38 sostenida más de 24 h alerta. <35 alerta (hipotermia).
- En `actividad: 'ejercicio'` o en EVA, tolerar +0,5 °C (calor por esfuerzo, no fiebre).
- Ruta `reporte` desde aviso. Acción: aislarse del resto (§8.3: puede contagiar), hidratarse, repetir en 2 h.
- `hrp: ['inmune', 'microorganismos']`.

**`inmune.reactivacion`** · sistema `inmune` · `sxPiel`, `sxAlergia`, `horasSueno`, `estres`, `dosisRadiacion`
- Sin síntoma no se evalúa (misma lógica que `reglaPsicosis`: el factor solo no es el problema).
- `sxPiel` o `sxAlergia` ≥3 aviso; ≥6 alerta. Agravantes: `factor().suenoBajo`, `estresAlto`.
- Texto: posible reactivación de un virus latente (herpes labial, zóster). Acción: no compartir utensilios, registrar foto, avisar al cirujano de vuelo.
- `sensible: false`, `ruta: 'reporte'`. Fuente: §7.1.1 y §8.3 "Inmunidad alterada".

### C2. Sensoriomotor y vestibular (§7.1.2) · archivo nuevo `reglas/sensoriomotor.ts`

**`vestibular.cinetosis`** · sistema `oidoInterno` · `sxMareo`, `sxNauseas`
- Máximo de ambos: ≥3 info; ≥5 aviso; ≥8 alerta.
- `transicionGravedad: true` → el texto explica que es esperable ("la mayoría de los astronautas lo sufre") y la acción cambia a movimientos de cabeza lentos y medicación según protocolo.
- En EVA o rover con nivel aviso o más → sube a alerta: vomitar dentro del casco es peligroso; `accionPorUbicacion.eva` = detener y volver.
- `bloquea: ['eva', 'pilotaje']` desde aviso.

**`vestibular.equilibrio`** · sistema `oidoInterno` · `equilibrio`
- Caída respecto a la línea base: 20 % aviso, 40 % alerta. `bloquea: ['eva', 'pilotaje']`.
- Acción: prevención de caídas, apoyo con ambas manos, repetir en 24 h.
- `hrp: ['sensoriomotor', 'cargasDinamicas']`.

### C3. Cardiovascular (§7.1.3) · `reglas/cardiovascular.ts`

**`cardio.arritmia`** · sistema `corazon` · `irregularidadRitmo`, `frecuenciaCardiaca`
- ≥5 % aviso; ≥15 %, o ≥5 % con FC en reposo ≥120, alerta con `posibleIncapacidad`.
- `pasos`: detener actividad, sentarse o sujetarse, registrar ECG si hay equipo, no quedarse solo.
- Agravante: antecedente con `sistema: 'corazon'`.

**Modificar `cardio.presion`**: recibir contexto. Con `transicionGravedad: true`, sistólica <100 ya es aviso y la acción menciona prendas de compresión e hidratación antes de ponerse de pie (Anexo F, contramedidas). Agregar `bloquea: ['pilotaje', 'eva']` en alerta por presión baja.

**`vascular.trombosis`** · sistema `piernas` · `flujoYugular`, `asimetriaPantorrilla`, `sxDolorPierna` · `hrp: ['trombosis', 'cardiovascular']`
- `flujoYugular` 2 info; 3 aviso; 4 alerta.
- `asimetriaPantorrilla` ≥2 cm aviso; ≥3 cm, o ≥2 cm con `sxDolorPierna` ≥4, alerta.
- Si además `sxDisnea` ≥5 → alerta con `posibleIncapacidad` (posible embolia pulmonar).
- `region: 'piernas'` o `'cuello'` según el dato dominante. Acción: no masajear la zona, ecografía guiada, reporte urgente a Tierra. Mencionar brazaletes de muslo como contramedida en estudio.

### C4. Descompresión (§7.1.4) · archivo nuevo `reglas/eva.ts`

**`descompresion.eva`** · sistema `cuerpo` · `sxDolorArticular`, `sxDisnea`, `sxNeurologico`, `prerrespiracion`, `duracionEva`
- **Ventana de riesgo:** `ubicacion === 'eva'`, o última lectura de `duracionEva` hace menos de 24 h.
- Antes de los síntomas: al entrar en la ventana con `prerrespiracion` por debajo de `PRERRESPIRACION_MIN` (constante provisional) → aviso "prerrespiración incompleta".
- Dentro de la ventana: `sxDolorArticular` ≥3 aviso; ≥6 alerta. `sxDisnea` ≥4 o `sxNeurologico` ≥3 → alerta con `posibleIncapacidad` (§7.1.4: síntomas similares a un ACV).
- `accionPorUbicacion.eva`: terminar la EVA de forma segura pero rápida y volver a la nave presurizada (protocolo actual, textual del documento).
- Fuera de la ventana no se evalúa: los mismos síntomas los toman otras reglas.
- `bloquea: ['eva', 'ejercicioIntenso']`.

### C5. Microorganismos (§7.1.5) · `reglas/inmune.ts`

**`microbioma.entorno`** · sistema `intestino` · `cargaMicrobiana`, `sxDigestivo`
- Carga sola: se evalúa la **tendencia** (`pendiente` en los últimos muestreos), no el valor aislado. Subida sostenida → info. Fuente textual: "el crecimiento microbiano no siempre justifica preocupación; lo importante es la vigilancia continua" (§8.3, Veggie).
- Carga alta **y** `sxDigestivo` ≥4 → aviso. Con `inmune.fiebre` activa (temperatura ≥38) → alerta.
- Acción: desinfectar superficies, no consumir del lote de agua, repetir hisopado.

### C6. Hipoxia (§7.1.6) · `reglas/respiratorio.ts`

**`hipoxia.cabina`** · sistema `pulmones` · `ppO2Cabina`, `spo2`, `sxCefalea`, `sxVision`, `orientacion`, `horasSueno`
- `ppO2Cabina` <18 kPa aviso; <16 alerta.
- **Cuadro de hipoxia leve:** dos o más de {`sxCefalea` ≥3, `sxVision` ≥3, orientación ≤7, sueño promedio <6 h} **junto con** (`spo2` promedio de 24 h entre 90 y 94, o `ppO2Cabina` <19) → aviso "posible hipoxia leve". Son los cuatro síntomas que lista §7.1.6.
- Texto tranquilo: la NASA lo compara con el mal de altura.
- `bloquea: ['eva', 'pilotaje']` en alerta.

Agregar a la regla existente `pulmones.spo2`: `bloquea: ['eva', 'pilotaje', 'ejercicioIntenso']` desde aviso.

### C7. Nutrición (§7.1.7) · archivo nuevo `reglas/metabolismo.ts`

**`metabolismo.glucemia`** · sistema `metabolismo` · `glucemia`
- <70 mg/dL aviso; <54 alerta con `posibleIncapacidad` y `pasos` (15 g de azúcar, repetir en 15 min). >180 aviso; >250 alerta.
- Agravante: antecedente familiar de diabetes en `antecedentesFamiliares` (solo se nombra en el detalle).

**`nutricion.ingesta`** · sistema `metabolismo` · `caloriasDia`, `sxApetito`
- Promedio de 3 días por debajo del 80 % de `perfil.requerimientoCalorico` → aviso; por debajo del 60 % → alerta. `sxApetito` ≥5 con ingesta baja nombra la fatiga de menú.

**`nutricion.peso`** · sistema `metabolismo` · `pesoCorporal`
- Pérdida respecto a la línea base: 3 % info; 5 % aviso; 10 % alerta. Ruta `reporte`.

**`nutricion.hidratacion`** · sistema `metabolismo` · `hidratacion`
- <1500 mL al cierre del día info; <1000 aviso.
- Con `transicionGravedad: true` o antes de aterrizar, el objetivo sube: la acción cita "beber mucho líquido para prevenir la hipotensión" (§7.1.3).

**`nutricion.fatigaMenu`** · sistema `intestino` · `aceptabilidadComida`
- Promedio de las últimas 3 encuestas ≤5 aviso; pendiente negativa sostenida info. Acción: rotar el menú, usar condimentos, comer en grupo.

### C8. Lesiones y rendimiento en EVA (§7.1.8) · `reglas/eva.ts`

**`eva.carga`** · sistema `musculos` · `duracionEva`, `frecuenciaCardiaca`, `temperatura`
- Duración >360 min aviso; >480 min alerta (el récord es 8 h 56 min, §7.1.8).
- FC sostenida ≥150 durante 20 min en EVA → aviso de sobreesfuerzo. Temperatura ≥38,5 en EVA → alerta (golpe de calor en el traje).
- Solo se evalúa con `ubicacion === 'eva'`.

**Aptitud previa a la EVA:** la resuelve `aptitudTareas()` de la Parte A (no es una regla).

### C9. Aptitud física (§7.1.9) · `reglas/musculoesqueletico.ts`

**`musculo.aptitud`** · sistema `musculos` · `fuerza`, `aptitudAerobica`
- Caída respecto a la línea base: 10 % info (es el promedio esperado, 10–12 %); 20 % aviso (umbral del documento: "12–38 % pierde más del 20 %"); 30 % alerta.
- Con ≥2 mediciones, citar la tendencia. `bloquea: ['eva']` desde 30 %.
- Acción: ajustar el plan de entrenamiento, priorizar resistencia.

**`musculo.adherencia`** · sistema `musculos` · `minutosEjercicio`, `minutosResistencia`
- Últimos 7 días: menos de 6 días con ≥90 min → info; menos de 4 → aviso (documento: 6–7 días por semana, 1,5 h/día).
- Si `minutosResistencia` promedio <30 min/día → el aviso nombra hueso y músculo.

La regla existente `musculo.ejercicio` se conserva (es el estado del día).

### C10. SANS (§7.1.10) · archivo nuevo `reglas/ojos.ts`

**`sans.vision`** · sistema `ojos` · `agudezaVisual`, `presionIntraocular`, `grosorRetina`, `sxVision`, `sxCefalea`
- `grosorRetina` ≥20 µm aviso; ≥50 alerta. (Verificar el criterio contra la fuente oficial antes de citarlo.)
- `presionIntraocular` >21 mmHg aviso; >30 alerta.
- `agudezaVisual` 10 % por debajo de la línea base aviso; 25 % alerta.
- `sxVision` ≥3 sin pruebas → info con acción "hacer la prueba de visión". `sxVision` ≥3 **con** cualquier prueba alterada → sube un nivel.
- Texto simple: es frecuente (~70 % tiene algo de hinchazón). Acción: prueba de visión y OCT, brazaletes de muslo según protocolo, reporte a Tierra. `region: 'cara'`. `bloquea: ['pilotaje']` en alerta.

### C11. Hueso (§7.1.11) · `reglas/musculoesqueletico.ts`

**`hueso.perdida`** · sistema `huesos` · `minutosResistencia`, `calcioUrinario` (y se reevalúa con el contexto)
- **Estimación:** `perdida% = (diaMision / 30) × tasa`, con `tasa` entre 1,0 y 1,5 %/mes (documento) según adherencia a resistencia de los últimos 30 días: buena → 0,5 (contramedida efectiva, provisional), parcial → 1,0, mala → 1,5.
- ≥5 % info; ≥10 % aviso; ≥15 % alerta. Antecedente óseo (osteopenia, `sistema: 'huesos'`) → umbrales 3, 7 y 12.
- `calcioUrinario` >250 mg/día sube un nivel y agrega "bebe más agua" (el calcio que sale del hueso).
- `detalleTecnico` debe decir que es una **estimación**, con sus insumos. `region: 'columna'`. `ruta: 'reporte'` desde aviso.
- En destino `orbita` con `diaMision` bajo, devuelve `normal`.

### C12. Conducta (§7.2.1) · `reglas/mental.ts`

**`mental.animoSostenido`** · sistema `cerebro` · `animo` · sensible
- Al menos 5 de los últimos 7 días con ánimo 2 o más puntos bajo la línea base → aviso; 10 de 14 → alerta, `ruta: 'reporte'`.
- Con `conexionTierra: false` la acción no promete una llamada: propone diario, jardín, compañero de confianza (§7.2.1).
- `textoCalmado` obligatorio.

### C13. Trabajo en equipo (§7.2.2) · `reglas/mental.ts`

**`equipo.cohesion`** · sistema `cerebro` · `cohesionEquipo` · sensible
- ≤5 aviso; ≤3 alerta; caída de 3 puntos respecto a la línea base → aviso.
- Nunca a la pantalla compartida (ya lo garantiza `sensible`). Acción: pausa, conversación guiada, actividad en común.

### C14. Sueño y horarios (§7.2.3) · `reglas/mental.ts`

**`sueno.circadiano`** · sistema `cerebro` · `desfaseCircadiano`
- ≥2 h aviso; ≥4 h alerta. Acción: luz intensa por la mañana, luz tenue de noche, sin cafeína tarde.

**`trabajo.sobrecarga`** · sistema `cerebro` · `horasTrabajo`
- Más de 10 h en 3 de los últimos 5 días → aviso; más de 12 h en 3 de 5 → alerta. Acción: tiempo de relajación asignado (burnout).

Agregar a `sueno.deficit` un `bloquea: ['pilotaje']` cuando el promedio es <5 h.

### C15. Soporte para operar sistemas (§7.2.4)

No es una regla: es una garantía del diseño. Se cubre con:
- Test que recorre todas las reglas y exige `pasos` en todo hallazgo de nivel alerta (ver §11).
- Un escenario dedicado: emergencia sin médico, sin enlace con el hábitat ni con Tierra, donde la guía paso a paso es lo único disponible.

### C16. Cargas dinámicas (§7.2.5) · `reglas/musculoesqueletico.ts`

**`lesion.cargaDinamica`** · sistema `huesos` · `aceleracionCuerpo`, `sxDolorEspalda`
- Pico de las últimas 24 h: ≥8 g info; ≥12 g aviso; ≥20 g alerta.
- Con `sxDolorEspalda` ≥4 tras la carga → sube un nivel; alerta lleva `pasos` de inmovilización.
- Agravante: `hueso.perdida` estimada ≥10 % (recalcular con el mismo ayudante, no leer otro hallazgo) u osteopenia.
- `region: 'columna'`. `bloquea: ['eva', 'ejercicioIntenso']`.

### C17. Radiación (§7.3.1) · `reglas/radiacion.ts`

Mejoras a `radiacion.dosis`:
- **Proyección:** con la pendiente de los últimos 7 días, "a este ritmo alcanzas el límite en N días". Se agrega al detalle; si N < días restantes estimados → info.
- **Destino:** en `luna` y `marte` (fuera de la magnetosfera) la tasa que dispara la alerta baja a la mitad.
- `bloquea: ['eva']` con tormenta activa o tasa alta.
- `hrp: ['radiacion']`.

### C18. Entorno (Anexo A, peligro 5) · archivo nuevo `reglas/entorno.ts`

**`entorno.ruido`** · sistema `oidoInterno` · `ruidoCabina`
- En horario de sueño (usar `estaDurmiendo`): >50 dBA info; >60 aviso. Fuera del sueño: >70 aviso; >85 alerta.
- `hrp: ['sueno']`.

### Resumen de cobertura al terminar

| Riesgo HRP | Reglas |
|---|---|
| inmune | `inmune.fiebre`, `inmune.reactivacion` |
| sensoriomotor | `vestibular.cinetosis`, `vestibular.equilibrio` |
| cardiovascular | `cardio.frecuencia`, `cardio.presion`, `cardio.arritmia`, `vascular.trombosis` |
| descompresion | `descompresion.eva` |
| microorganismos | `microbioma.entorno`, `inmune.fiebre` |
| hipoxia | `pulmones.spo2`, `hipoxia.cabina` |
| nutricion | `metabolismo.glucemia`, `nutricion.ingesta`, `nutricion.peso`, `nutricion.hidratacion`, `nutricion.fatigaMenu` |
| eva | `eva.carga`, `descompresion.eva`, aptitud de tareas |
| aptitud | `musculo.ejercicio`, `musculo.adherencia`, `musculo.aptitud` |
| sans | `sans.vision` |
| oseo | `hueso.perdida` |
| conductual | `mental.animo`, `mental.animoSostenido`, `mental.estres`, `mental.psicosis`, `mental.orientacion` |
| equipo | `equipo.cohesion` |
| sueno | `sueno.deficit`, `sueno.circadiano`, `trabajo.sobrecarga`, `entorno.ruido` |
| sistemas | garantía por test + escenario |
| cargasDinamicas | `lesion.cargaDinamica`, `trauma.craneal`, `vestibular.equilibrio` |
| radiacion | `radiacion.dosis` |
| trombosis | `vascular.trombosis` |

Total: 11 reglas existentes + 25 nuevas = **36 reglas**.

---

## 7. Parte D: conversación e IA

### D1. Intérprete local (`core/conversacion.ts`)

- La tabla `SINTOMAS` cambia de forma: cada entrada produce una **lectura** `sx*` y, solo para lo urgente, además la alerta inmediata.
  - Intensidad por defecto 5. Modificadores en la frase: "leve", "un poco", "algo" → 3; "fuerte", "mucho", "intenso", "insoportable" → 8.
  - **Se conservan como `emitir_alerta` inmediata** (camino de seguridad `esUrgente`, no depende de reglas): dolor de pecho, no poder respirar, sensación de desmayo, golpe en la cabeza.
  - Pasan a lectura: dolor de cabeza → `sxCefalea`; mareo → `sxMareo`; náuseas → `sxNauseas`; visión borrosa → `sxVision`; falta de aire leve → `sxDisnea`.
  - Nuevos patrones: dolor de articulaciones, hombro, codo o rodilla → `sxDolorArticular`; hormigueo, se me duerme, no puedo mover, me cuesta hablar → `sxNeurologico`; erupción, sarpullido, herpes, ampolla en el labio → `sxPiel`; alergia, estornudos, picazón → `sxAlergia`; diarrea, dolor de panza o de estómago → `sxDigestivo`; dolor de espalda, lumbar, columna → `sxDolorEspalda`; dolor o hinchazón en la pierna o pantorrilla → `sxDolorPierna`; no tengo hambre, sin apetito, la comida me aburre → `sxApetito`.
  - Respuesta de texto: "Lo registro" + qué va a pasar. Si la regla no eleva nada, no hay alerta.
- Registros numéricos nuevos: "mi temperatura es 38,2", "glucemia 95", "peso 71 kilos", "tomé dos litros de agua", "comí 1800 calorías", "trabajé once horas", "presión 120 sobre 80".
- `CONSULTAS`: agregar temperatura, glucemia, visión/ojos, huesos, fuerza, peso/nutrición, equilibrio, piernas.
- Ampliar `NUMEROS` o reemplazarlo por un conversor de números en palabras hasta 999.

### D2. Contrato y servidor de IA

- `adaptadores/ia/contrato.ts`: `SENSORES_CONVERSACION` se **deriva** de `INFO_SENSOR` (los `porVoz`) más el caso especial `minutosEjercicioRealizados`.
- `server/ia.ts`: en `SISTEMA_CONVERSACION`, reemplazar la lista fija por una tabla generada (dato, unidad, rango) y explicar que los síntomas se devuelven como lecturas `sx*` con intensidad 0–10, y que `emitir_alerta` queda para lo que no tiene dato propio.
- `App.tsx` → `lecturasDesdeIA`: **recortar cada valor al rango** de `INFO_SENSOR` y descartar sensores desconocidos.
- `SISTEMA_EVALUACION`: agregar que el hallazgo trae `hrp` (riesgo NASA) y que puede nombrarlo.

---

## 8. Parte E: motor del simulador

Carpeta `app/src/adaptadores/simulador/`.

### E1. Modelo de escenario (`escenarios.ts` → partir en `escenarios/` por categoría)

```ts
export interface PasoEscenario {
  enMs: number;                    // desde el inicio del escenario
  titulo: string;                  // "El dolor empeora"
  narracion: string;               // qué está pasando, para quien presenta
  contexto?: Partial<Contexto>;
  lecturas?: (t: number, h: Historial) => Lectura[];
  frase?: string;                  // lo que "dice" el astronauta: pasa por el asistente
  tripulacion?: Partial<ConductaTripulacion>;
  esperado?: { riesgoId: string; nivel: Nivel }[];
  esperaEscalada?: boolean;        // el paso consiste en no responder
}
export interface Escenario {
  id: string; nombre: string; descripcion: string;
  categoria: 'fisiologia' | 'conducta' | 'radiacion' | 'entorno' | 'sistema';
  hrp: IdRiesgoHRP[]; peligros: Peligro[];
  nivelMaximo: Nivel;              // para la insignia de la tarjeta
  queObservar: string[];           // 2 a 4 puntos
  perfil?: string;                 // id sugerido (AST-01…)
  contextoInicial?: Partial<Contexto>;
  precarga?: (t: number) => Lectura[];   // historia hacia atrás, en días reales
  pasos: PasoEscenario[];
  reiniciar?: boolean;             // por defecto true
}
```

- Los 15 escenarios actuales se migran a este formato **conservando sus `id`** (los usa la acción `ejecutar_escenario` y la IA). Un escenario de un disparo es un escenario de un paso.
- Corregir las noches separadas por 1 ms: usar `t - n * DIA`.
- Ayudante `serie(sensor, valores[], t, pasoMs)` para escribir precargas cortas.
- `GUION_DEMO: string[]`: lista ordenada de ids para el pitch (ver Parte G).

### E2. Reproductor (`reproductor.ts`, nuevo, sin React)

Clase `Reproductor` con estados `inactivo | reproduciendo | pausado | terminado`.

- `iniciar(escenario)`, `pausar()`, `reanudar()`, `siguiente()` (salta al próximo paso ya), `reiniciar()`, `detener()`, `velocidad` (1, 2, 4).
- Recibe por constructor: `aplicarPaso(paso, t)`, `alCambiar(estado)` y un programador de tiempo inyectable (por defecto `setTimeout`) para poder testearlo con tiempo falso.
- Expone `estado`, `indicePaso`, `msHastaSiguiente`.
- Un paso con `esperaEscalada` no avanza hasta que venza la confirmación o el usuario toque "siguiente".

### E3. Conducta de la tripulación (`tripulacion.ts`)

`interface ConductaTripulacion { responde: boolean; demoraMs: number; medicoResponde: boolean; tierraResponde: boolean }`. `respuestaSimulada` la recibe como parámetro. Permite demostrar "nadie responde → baliza" y "Tierra responde con retardo".

### E4. Registro de la simulación (`registro.ts`, nuevo)

Lista acotada (200) de eventos: `{ t, tipo: 'paso' | 'lecturas' | 'contexto' | 'hallazgo' | 'mensaje' | 'escalada' | 'respuesta' | 'frase', texto, nivel?, detalle? }`. Lo alimenta la app en `procesar`, `cambiarContexto` y el reproductor. Para `mensaje`, el detalle es `mensaje.motivo` (por qué ese canal).

### E5. Integración en la app (`ui/simulador/useSimulador.ts`, nuevo)

`App.tsx` ya tiene 483 líneas: sacar de ahí todo lo del simulador a un hook.

- El núcleo pasa a `useState` **con setter**. `reiniciarSimulacion(perfilId?, contexto?)` crea un `NucleoSalud` nuevo y limpia `mensajes`, `evaluaciones`, `avisoComunicacion`, `turnos`, `preavisados`, `chequeo`, `impactosChequeados`, el registro, y llama a `detener()` de la voz. Revisar que los `useCallback` y `useEffect` que cierran sobre `nucleo` lo tengan en dependencias.
- `ejecutarEscenario(e)`: reinicia (si corresponde), aplica perfil sugerido y contexto inicial, registra la precarga **sin emitir mensajes** (ver abajo) y arranca el reproductor.
- **Precarga silenciosa:** agregar a `NucleoSalud` un método `precargar(lecturas, ahora)` que carga el historial, evalúa todas las reglas y fija `emitido` y `hallazgos` sin devolver mensajes ni abrir confirmaciones. Así el escenario empieza con la figura ya coloreada y sin una ráfaga de voz.
- `aplicarPaso`: contexto → lecturas → frase (por el mismo camino que el chat: revisar la API de `useAsistente` en `ui/asistente.ts` y exponer lo necesario para que la frase aparezca en la conversación como dicha por el astronauta).
- **IA durante escenarios:** interruptor "Evaluación con IA en el simulador" (apagado por defecto en el guion). Cada mensaje nuevo dispara una llamada con costo; un escenario de seis pasos puede disparar muchas.
- **Voz:** si Higia está hablando cuando toca el paso siguiente, esperar a que termine (con tope de 8 s) para que no se pisen.
- Acción del asistente `ejecutar_escenario`: sigue funcionando. Agregar `control_simulador { orden: 'pausar' | 'continuar' | 'siguiente' | 'reiniciar' | 'detener' }` en `core/acciones.ts`, su validación, el intérprete local y el prompt del servidor.

---

## 9. Parte F: interfaz del simulador

Carpeta nueva `app/src/ui/simulador/`. `PanelDemo.tsx` se reemplaza. Estilos en `estilos.css`, con las variables existentes. Mantener: tecla `D`, `Esc`, `inert` cuando está cerrado, recordar abierto/cerrado.

En la interfaz se llama **"Simulador"** (el botón de la barra superior y los textos que hoy dicen "demo").

### F1. Estructura

```
┌─────────────── app del astronauta ───────────────┬──── Simulador ────┐
│                                                  │ [Escenarios] …    │
│                                                  │                   │
│                                                  │                   │
├──────────────────────────────────────────────────┴───────────────────┤
│ ▶ DCS durante una EVA · Paso 3/5 · "El dolor empeora…"   ⏸ ⏭ ↺ ×1 ✕ │
└──────────────────────────────────────────────────────────────────────┘
```

- **Panel lateral con dos tamaños:** compacto (380 px, como hoy) y amplio (`min(920px, 68vw)`), con un botón para alternar. En amplio, las pestañas usan dos columnas. En pantallas de menos de 900 px, ocupa todo el ancho.
- **Barra de reproducción** (`BarraReproduccion.tsx`): fija abajo mientras hay un escenario activo, **aunque el panel esté cerrado**. Muestra nombre, paso actual con su narración, progreso por pasos, cuenta regresiva al siguiente paso y controles (pausa, siguiente, reiniciar, velocidad, cerrar). Si el paso es "no respondas", lo dice de forma explícita. `aria-live="polite"` para la narración. Reservar su alto con una variable CSS (`--alto-reproductor`) para que no tape el contenido ni `AccesoHigia`.

### F2. Pestañas

**1. Escenarios** (`PestanaEscenarios.tsx`)
- Arriba: tarjeta "Guion de la demo" con botón "Reproducir guion" (encadena los escenarios de `GUION_DEMO`, con pausa entre uno y otro hasta que el presentador toque "siguiente").
- Buscador por texto y filtros: por **peligro** (los 5 de la NASA), por **categoría**, por **nivel máximo**.
- Tarjetas agrupadas por categoría. Cada una: nombre, descripción, insignia de nivel, etiquetas de riesgos HRP, cantidad de pasos y duración. Marca de "ya reproducido" en esta sesión.
- Al abrir una tarjeta: "Qué observar", perfil sugerido, lista de pasos, y botones "Reproducir" y "Paso a paso" (arranca pausado).

**2. Datos** (`PestanaDatos.tsx`) — inyección manual, **nueva**
- Un control por cada dato de `INFO_SENSOR`, agrupado por `categoria` en secciones plegables, generado desde el catálogo (sin escribir cada control a mano).
- Cada fila: nombre, último valor con su unidad, deslizador + campo numérico con `min`, `max` y `paso`, marca de la línea base del perfil si existe, y el nivel actual del hallazgo que usa ese dato (punto de color).
- Se inyecta al **soltar** el deslizador o confirmar el campo (no en cada movimiento): `fuente: 'manual'`.
- Presión arterial: sistólica y diastólica se envían juntas.
- Botón "Día normal" (carga valores en rango para todos los datos) y "Limpiar todo" (reinicia).

**3. Contexto** (`PestanaContexto.tsx`)
- Lo que hay hoy, más: **día de misión** (deslizador 1–900 con atajos 30, 180, 500), **transición de gravedad** (interruptor), y un bloque "EVA" con dos acciones: "Iniciar EVA" (pide los minutos de prerrespiración, cambia ubicación y empieza a emitir `duracionEva`) y "Terminar EVA".
- Mostrar el semáforo de **aptitud para tareas** (`aptitudTareas()`): EVA, pilotaje, ejercicio intenso, con los motivos.

**4. Tripulación** (`PestanaTripulacion.tsx`)
- Selector de astronauta (lo de hoy), mostrando además sus antecedentes relevantes y líneas base.
- Conducta de respuesta (E3): responde o no, demora, médico, Tierra.
- Agregar un cuarto perfil en `perfiles.ts` para ampliar los casos: comandante de 52 años, veterana, formación básica, con antecedente cardiovascular familiar y un valor previo de presión intraocular en el límite.

**5. Cobertura** (`PestanaCobertura.tsx`) — **nueva**
- Tabla de los 18 riesgos HRP: nombre, sección del documento, peligros, estado en vivo (`estadoRiesgosHRP()`), reglas que lo cubren y escenarios que lo demuestran (botón para reproducirlos). Enlace a la página de la NASA.
- Encabezado: "18 de 18 riesgos con detección".
- Es la pantalla para responder al jurado "¿qué riesgos de la NASA cubren?".

**6. Registro** (`PestanaRegistro.tsx`) — **nueva**
- Línea de tiempo de E4, del más nuevo al más viejo: qué inyectó el simulador y qué hizo Higia, con el motivo del canal. Filtro por tipo. Botón "copiar como texto".

### F3. Cambios menores en la app del astronauta

- `VistaResumen`: tarjeta "Aptitud para tareas" (EVA, pilotaje, ejercicio intenso) debajo de "Requiere atención". Solo se muestra si algo está bloqueado.
- `VistaMensajes` y el detalle de sistema en `VistaResumen`: etiqueta con el riesgo NASA del hallazgo (`hrp`).
- `VistaEntorno`: mostrar día de misión y transición de gravedad.
- Textos que hoy dicen "Abrir demo" o "Cambiar en la demo" → "simulador".

### F4. Accesibilidad e interacción

- Pestañas con el patrón `tablist` actual, navegables con flechas.
- Atajos con el foco dentro del panel o la barra: `Espacio` pausa o reanuda, `N` siguiente paso, `R` reinicia. Respetar `escribiendo(e)`.
- Deslizadores con `aria-valuetext` que incluya la unidad.
- Nada depende solo del color: las insignias de nivel llevan texto.
- Cargar el skill `impeccable` (o `design-taste-frontend`) antes de escribir la interfaz, para mantener el nivel visual de la app actual.

---

## 10. Parte G: catálogo de escenarios

Se conservan los 15 actuales (migrados). Los 25 nuevos (40 en total), cada uno con `esperado` por paso:

| id | Nombre | Pasos (resumen) | Demuestra | HRP |
|---|---|---|---|---|
| `fiebre` | Fiebre a bordo | 37,6 → 38,3 → 39,1 | Escalada gradual, aislamiento, reporte | inmune, microorganismos |
| `herpes` | Herpes labial tras una mala semana | Precarga: 6 noches de 4,5 h y estrés alto. Frase: "me salió una ampolla en el labio" | Síntoma contado + factores = reactivación viral | inmune, sueño |
| `cinetosis-llegada` | Primeros días en microgravedad | Luis (novato). Náuseas 4 → 6; intenta salir a EVA | Esperable en transición; bloqueo de EVA | sensoriomotor, eva |
| `rover-mareo` | Mareo al conducir el rover | Transición de gravedad, equilibrio −35 %, sube al rover | Aptitud para pilotaje | sensoriomotor, cargasDinamicas |
| `arritmia` | Latidos irregulares en reposo | 6 % → 18 % con FC 124 | Alerta con guía, sin médico a bordo | cardiovascular |
| `aterrizaje-desmayo` | De pie tras aterrizar | Transición, hidratación baja, PA 96/60 → 78/50, no responde | Contramedidas de aterrizaje y escalada | cardiovascular, nutricion |
| `trombo-yugular` | Hallazgo en la ecografía de cuello | Día 50, flujo grado 3 → 4, luego dolor de pierna | Tromboembolismo, reporte a Tierra con retardo | trombosis |
| `descompresion` | Dolor de hombro durante una EVA | Prerrespiración incompleta → aviso; dolor 4 → 7; hormigueo; no responde | Ventana de riesgo, protocolo de regreso, escalada al compañero | descompresion, eva |
| `descompresion-tardia` | Dolor articular dos horas después de la EVA | Ya en el hábitat, dolor 5 | La ventana post-EVA cambia la interpretación | descompresion |
| `hipoxia-cabina` | Cabina de exploración a baja presión | Marte, ppO₂ 18,5; precarga de SpO₂ 92–93; "me duele la cabeza" y sueño corto | Cuadro de hipoxia leve por síntomas combinados | hipoxia |
| `fatiga-menu` | La comida ya no apetece | Precarga de 3 semanas: aceptabilidad 7 → 4, calorías al 70 %, peso −6 % | Tendencias, tres reglas encadenadas | nutricion |
| `hipoglucemia` | Bajón tras una EVA larga | Glucemia 66 → 52 | Alerta con pasos simples | nutricion, eva |
| `eva-larga` | EVA de siete horas | duracionEva 300 → 380 → 490, FC sostenida | Sobreesfuerzo y límite de duración | eva, aptitud |
| `fuerza` | Evaluación mensual de fuerza | Precarga con ejercicio irregular; fuerza −22 % | Umbral del 20 % del documento | aptitud |
| `hueso-dia-150` | Día 150 con poca resistencia | Ana (osteopenia). Precarga de 30 días; calcio urinario 290 | Estimación personalizada por antecedente | oseo |
| `sans` | Visión borrosa de cerca | "Veo borroso" → prueba 88 → OCT +28 µm → PIO 24 | Del síntoma a la prueba; SANS | sans |
| `animo-sostenido` | Diez días grises camino a Marte | Precarga de 10 días con ánimo 4; sin enlace con Tierra | Privacidad, tendencia, autocuidado sin Tierra | conductual |
| `conflicto` | Tensión en la tripulación | Cohesión 8 → 5 → 3 | Dato sensible, canal privado | equipo |
| `turnos` | Semana de turnos corridos | Desfase 3 h, 12 h de trabajo por 4 días, sueño 5 h | Tres hallazgos de sueño y horarios; bloqueo de pilotaje | sueno |
| `ruido-noche` | Ventilador ruidoso de madrugada | 03:00, 64 dBA | Aviso retenido hasta despertar | sueno |
| `aterrizaje-brusco` | Aterrizaje con carga alta | 14 g; "me duele la espalda"; día 200 | Agravante por pérdida ósea estimada | cargasDinamicas, oseo |
| `agua-contaminada` | Hisopado del agua en aumento | Precarga: tendencia de carga; luego síntomas digestivos; luego fiebre | Vigilancia de tendencia: info → aviso → alerta | microorganismos, inmune |
| `tormenta-marte` | Tormenta solar en EVA en Marte | EVA, tasa alta, sin enlace con Tierra | Umbral por destino, refugio | radiacion |
| `autonomia` | Emergencia sin nadie al alcance | Marte, sin médico ni enlaces ni compañero: arritmia grave, no responde | Guía paso a paso y baliza | sistemas, cardiovascular |
| `dia-200` | Día 200: todo un poco | Varios datos apenas fuera de rango en cinco sistemas | Los peligros se potencian: muchas señales leves | varios |

**Guion sugerido para el pitch** (`GUION_DEMO`, unos 5 minutos): `base` → `descompresion` → `sans` → `animo-sostenido` → `hueso-dia-150` → `autonomia`. Recorre los cinco peligros y termina en la pestaña Cobertura.

---

## 11. Tests

Todos en `app/src/`, con vitest. Mantener el estilo de `nucleo.test.ts` (ayudantes `L`, `nuevo`).

| Archivo | Qué verifica |
|---|---|
| `core/reglas/reglas.test.ts` (nuevo) | Por cada regla nueva: sin datos → `null`; valor normal → `normal`; cada umbral; cada agravante de contexto o de historia clínica; `sensible`, `posibleIncapacidad`, `bloquea` donde corresponde |
| `core/cobertura.test.ts` (nuevo) | Cada `IdRiesgoHRP` (salvo `sistemas`) tiene al menos una regla y al menos un escenario. Toda regla tiene `fuente` y `hrp` no vacíos. Todo `TipoSensor` tiene entrada completa en `INFO_SENSOR` y lo usa alguna regla. **Toda alerta que una regla pueda devolver trae `pasos`** (se recorre con los escenarios) |
| `adaptadores/simulador/escenarios.test.ts` (nuevo) | Recorre **todos** los escenarios: aplica precarga y pasos sobre un núcleo real con tiempos simulados y comprueba cada `esperado`. Ids únicos. Los ids viejos siguen existiendo. `GUION_DEMO` apunta a ids válidos |
| `adaptadores/simulador/reproductor.test.ts` (nuevo) | Con tiempo falso: orden de pasos, pausa, reanudar, siguiente, velocidad, detener a mitad |
| `core/nucleo.test.ts` | Caducidad de hallazgos; `aptitudTareas`; aviso al salir a EVA no apto; `precargar` no emite mensajes; `estadoRiesgosHRP` |
| `core/asistente.test.ts` | Síntomas como lecturas con intensidad; lo urgente sigue siendo alerta inmediata; registros numéricos nuevos |

---

## 12. Orden de implementación

Cada fase deja el proyecto compilando y con tests en verde. Un commit por fase.

| Fase | Contenido | Depende de |
|---|---|---|
| **1. Cimientos** | Parte A completa (A1–A4), `hrp` en las 11 reglas existentes, tests de caducidad y aptitud | — |
| **2. Catálogo de datos** | Parte B: `TipoSensor`, `INFO_SENSOR` ampliado, líneas base y `requerimientoCalorico` en perfiles | 1 |
| **3. Reglas con datos ya existentes** | `inmune.fiebre`, `metabolismo.glucemia`, mejoras de `radiacion.dosis` y `cardio.presion` | 2 |
| **4. Reglas fisiológicas** | C2, C3, C4, C6, C8, C10 | 2 |
| **5. Reglas de largo plazo y hábitos** | C5, C7, C9, C11, C16, C18 | 2 |
| **6. Reglas de conducta** | C12, C13, C14 | 2 |
| **7. Conversación e IA** | Parte D | 2 a 6 |
| **8. Motor del simulador** | Parte E + migración de los 15 escenarios + `escenarios.test.ts` | 1 |
| **9. Escenarios nuevos** | Parte G, con `esperado`; `cobertura.test.ts` | 3 a 8 |
| **10. Interfaz del simulador** | Parte F | 8 |
| **11. Cierre** | Actualizar `README.md` (tabla de reglas, escenarios, panel, cantidad de tests, "Cómo extenderlo"), quitar el TODO de `musculoesqueletico.ts`, revisar con la app corriendo el guion completo | todo |

Las fases 8 y 10 se pueden adelantar si se prioriza la demo: no dependen de las reglas nuevas.

---

## 13. Riesgos del plan y cosas a vigilar

- **Falsos positivos por cantidad de reglas.** Con 36 reglas, un "día normal" tiene que seguir todo en verde. El escenario `base` debe cargar valores normales para **todos** los datos y su `esperado` es "ningún hallazgo por encima de info".
- **Doble aviso por el mismo problema.** Un dolor de cabeza puede tocar `hipoxia.cabina`, `sans.vision` y `descompresion.eva`. Regla general: una regla sindrómica solo se dispara con su combinación; un síntoma aislado no produce más de un hallazgo de nivel aviso. Cubrirlo con un test por síntoma.
- **Ráfaga de voz.** Varios hallazgos en un mismo paso se leen seguidos. En el reproductor, agrupar: leer solo el de mayor nivel y mostrar el resto en pantalla.
- **Costo de IA.** Ver E5: apagada por defecto durante el guion.
- **Reinicio del núcleo en React.** Es el cambio más delicado de `App.tsx`: temporizadores y callbacks que capturan el núcleo viejo. Probar a mano: reproducir un escenario con escalada pendiente, reiniciar, y confirmar que no llega una escalada fantasma.
- **Umbrales.** Los valores de este plan son un punto de partida razonable, no validados. Los que vienen del documento están indicados; el resto lleva la marca de provisional y la advertencia del README.
- **Tamaño de `tipos.ts`.** Si `INFO_SENSOR` crece demasiado, moverlo a `core/sensores.ts` y reexportarlo desde `tipos.ts` para no romper imports.
- **Historial acotado a 500 lecturas por dato.** Suficiente para las ventanas de 30 días de este plan si las precargas son de una lectura por día.

---

## 14. Decisiones abiertas para el equipo

Ninguna bloquea el inicio; el plan toma la opción marcada por defecto.

1. **Umbrales de kinesiología** (fuerza, equilibrio, adherencia, hueso, cargas): los propone el plan; conviene que quien aporta kinesiología los revise antes de la demo. *Por defecto: los de este documento.*
2. **Destino "tránsito"** (espacio profundo, en viaje): hoy solo existen órbita, Luna y Marte. Sumarlo afecta `RETARDO_TIERRA`, `NOMBRE_DESTINO` y el esquema de la IA de entorno. *Por defecto: no se agrega.*
3. **Nombre visible:** "Simulador" en lugar de "Demo". *Por defecto: Simulador.*
4. **Rutinas de medición** (recordar al astronauta que haga la prueba de visión, el hisopado, la encuesta): varios riesgos nuevos dependen de datos que alguien tiene que cargar. Queda fuera de este plan y es el siguiente paso natural.
