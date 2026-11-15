# Higia: sistema autónomo de monitoreo de salud

Prototipo para el NASA Space Apps Challenge 2026: *Create Health Monitoring Software for Astronauts*.

Higia vigila la salud de astronautas que viven en hábitats permanentes (base lunar, futura base en Marte). No pretende reinventar el diagnóstico: aplica criterios del desafío y del Human Research Program de la NASA. Su aporte está en **cómo** llega la información:

- **Funciona sin conexión.** Toda la lógica esencial corre en el dispositivo; la IA y la conexión con el hábitat solo suman capacidades (conversación y evaluaciones con IA, envío de reportes).
- **Se adapta a cada persona.** El mismo dato se comunica distinto a una médica veterana que a un ingeniero novato propenso al pánico.
- **Elige cuándo y por dónde interrumpir.** Pantalla compartida, pantalla personal o auricular, según dónde esté el astronauta, qué esté haciendo y si la información es privada.
- **No se queda callado ante una emergencia.** Si el astronauta no responde a una alerta, avisa a quien esté al alcance.

---

## Índice

1. [Qué puede hacer Higia](#qué-puede-hacer-higia)
2. [Cómo correrlo](#cómo-correrlo)
3. [Guion para la demo](#guion-para-la-demo)
4. [La interfaz](#la-interfaz)
5. [Funcionalidades en detalle](#funcionalidades-en-detalle)
6. [Arquitectura](#arquitectura)
7. [Estructura del código y reparto del trabajo](#estructura-del-código-y-reparto-del-trabajo)
8. [Cómo extenderlo](#cómo-extenderlo)
9. [Estado del plan de riesgos y simulador (traspaso)](#estado-del-plan-de-riesgos-y-simulador-traspaso)
10. [Solución de problemas](#solución-de-problemas)
11. [Advertencias](#advertencias)

---

## Qué puede hacer Higia

| Capacidad | En una frase |
|---|---|
| **Detectar riesgos** | 36 reglas que cubren los **18 riesgos de salud del HRP de la NASA** (radiación, huesos, sueño, salud mental, SANS, descompresión, hipoxia, coágulos…), comparadas con la línea base de cada astronauta |
| **Sumar señales leves** | Muchas señales leves en sistemas distintos (sueño, ánimo, radiación, hueso) se suman en un aviso que desaconseja la EVA, aunque ninguna sea grave sola |
| **Usar los datos** | Cada análisis registra los datos exactos en que se basó (valor, hora, fuente y línea base) y los muestra; la evaluación de la IA debe citar los datos que usó y declarar lo que falta |
| **Entender el contexto** | Interpreta distinto según ubicación, actividad, destino, clima espacial y hora; por ejemplo, no alarma por pulso alto durante el ejercicio |
| **Hablar solo cuando hace falta** | Avisa cuando algo cambia, no repite y respeta el horario de sueño |
| **Personalizar el mensaje** | Cifras para quien es médico, indicaciones claras para quien no, tono calmado para quien es propenso al pánico |
| **Elegir el canal** | Lo privado nunca va a la pantalla compartida; fuera del hábitat, mensajes breves por auricular |
| **Escalar emergencias** | Si una alerta no recibe "Estoy bien", primero lo advierte por voz y luego **se comunica con otros** (compañero, médico, base o Tierra) enviando qué pasó, dónde está el astronauta y su historia clínica; si no hay nadie, activa una baliza. Las respuestas se ven en vivo |
| **Asistente al centro** | Higia es la base de la app: se activa al oír su nombre ("Higia, …") y desde la conversación consulta el estado, **pide ayuda**, **envía mensajes** a otros astronautas o a Tierra, **emite alertas** por síntomas que cuenta el astronauta y maneja toda la app |
| **Historia clínica previa** | Cada astronauta tiene su historia (alergias, antecedentes, medicación, cirugías). La usan la IA, los mensajes y las comunicaciones de emergencia |
| **Funcionar sin médico** | Si no hay médico a bordo, da guías paso a paso y dirige los reportes a la base o a Tierra |
| **Conversar** | Por voz (diciendo "Higia") o texto; con IA entiende frases libres y registra los datos que menciona el astronauta |
| **Ver el entorno** | Con IA, analiza una foto de la cámara para detectar peligros y confirmar el contexto |
| **Integrarse** | Exporta hallazgos en formato HL7 FHIR hacia sistemas médicos (interfaz de ejemplo) |
| **Mostrarlo todo** | Figura anatómica por categoría (órganos, músculos o huesos, de frente o de espalda) con zonas como cráneo, costillas o pectorales coloreadas por estado, mensajes explicados, historial de escaladas y reportes |

---

## Cómo correrlo

**Requisitos:** Node.js 18 o superior y un micrófono.

- **Google Chrome o Microsoft Edge:** usan el reconocimiento de voz del navegador (necesita internet).
- **Brave, Firefox o Chromium:** usan **Vosk local** (funciona sin conexión). Hay que descargar el modelo español grande una vez con `npm run voz:modelo` (~1,4 GB).
- **Voz de Higia:** una **voz neuronal local (Piper)**, natural y sin conexión. Se descarga una vez con `npm run voz:piper` (~80 MB). Sin ella, Higia habla con la voz del navegador.

```bash
cd app
npm install
npm run voz:modelo  # reconocimiento de voz local en español (~1,4 GB, una sola vez; no se sube a git)
npm run voz:piper   # voz neuronal de Higia (~80 MB, una sola vez; no se sube a git)
npm run dev         # abre http://localhost:5173
npm test            # tests del núcleo
npm run build       # chequeo de tipos y build de producción
```

### Documentos de referencia (no están en el repo)

Las reglas citan anexos de dos documentos que **no se suben a git**. Pídeselos al equipo y ponlos en la raíz del repo, junto a este README:

- `NASA Space Apps Challenge Sistema Autónomo de Monitoreo de Salud para Hábitats E.pdf`: documento de visión del proyecto.
- `DESAFIO_HEALTH_MONITOR.md`: traducción del desafío con todos sus anexos (A–G). Cuando una regla dice "Anexo F", se refiere a este archivo.

Fuente oficial del desafío: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/

### Activar la IA (opcional)

Sin IA, Higia funciona completa con el intérprete local. Para activar la conversación natural, las evaluaciones con IA de cada hallazgo y el análisis de cámara:

1. Copia `app/.env.example` como `app/.env.local` (o `app/.env`) y pon tu clave: `DEEPSEEK_API_KEY=...` (clave de la [API de DeepSeek](https://platform.deepseek.com/)). La IA usa el modelo DeepSeek-V4.1-Flash (`deepseek-flash`) y pide las respuestas estructuradas con una herramienta forzada, que es el modo fiable de obtener JSON del modelo. Ese archivo no se sube a git.
2. Reinicia `npm run dev`. El indicador de la barra superior pasa a **IA activa**: desde ese momento el asistente responde con la IA y cada hallazgo nuevo recibe una evaluación de la IA, sin necesidad de activar ningún interruptor.

La IA solo existe con `npm run dev`, porque el servidor de desarrollo es el que guarda la clave. Un build estático (`npm run build`) funciona en modo local.

---

## Guion para la demo

La app abre en **Higia**, el asistente. Abre el **Simulador** con el botón de la barra superior o la tecla **D**: se abre al costado sin tapar la interfaz, así que el efecto de cada escenario se ve en vivo. Al reproducir un escenario aparece abajo la **barra de reproducción** con la narración de cada paso (también con el panel cerrado).

**Atajo:** en **Escenarios → Guion de la demo → Reproducir guion** se encadenan seis escenarios que recorren los cinco peligros (unos 5 minutos); entre uno y otro espera «Siguiente».

Recorrido sugerido, paso a paso:

1. **Día normal en el hábitat**: en **Resumen**, la figura se pinta de verde y aparece "Todo en orden".
2. **EVA: golpe en la estación**: llega un mensaje breve por auricular. En **Mensajes**, abre "Por qué este mensaje" para ver el canal elegido, la base científica y cómo lo recibiría cada astronauta.
3. En **Tripulación**, cambia a Luis Pérez (novato, propenso al pánico) y repite el escenario: el texto no nombra el pánico.
4. **Sesión de ejercicio**: 125 lpm no dispara alarma, porque el contexto dice que está entrenando.
5. **Descenso del ánimo**: va a la pantalla personal, nunca a la compartida, y se marca como "Privado".
6. **Crisis sin respuesta**: aparece la franja roja arriba, con una barra que muestra cuánto queda del plazo. No presiones "Estoy bien": a 10 s del plazo Higia advierte por voz que va a avisar a otros, y al vencer se comunica con el compañero cercano. El aviso de comunicación muestra las etapas (enviando → entregado → respondió) y la respuesta en vivo; el detalle, con la historia clínica enviada, queda en **Comunicaciones**.
7. **Día 200: las señales se suman**: en **Resumen** aparece "Día 200 de misión" y la tarjeta **Señales que se suman** (dos semanas de mal sueño, ánimo en baja, radiación y hueso) con la conclusión "Hoy no se recomienda salir a EVA"; "Aptitud para tareas" la marca. Al salir a EVA, Higia avisa. En **Mensajes**, el detalle de cada aviso muestra su tendencia.
8. **Aviso de madrugada**: queda retenido. En **Contexto**, cambia la hora a 08:00 y se entrega.
9. En **Contexto**, apaga **Médico a bordo** y ejecuta **Hipoxia**: aparece la guía paso a paso.
10. Activa **Conexión con el hábitat**: se vacía la cola de reportes (**Reportes**) y sale lo que estaba en cola en **Comunicaciones**.
11. En **Higia**, di (o escribe) "Higia, anoche dormí como cinco horas y me siento cansado": registra el dato. Con clave, mira la **Evaluación de Higia · IA** en cada mensaje.
12. "Higia, dile a Tierra que terminé la reparación": el mensaje aparece en **Comunicaciones** (en cola si no hay enlace con Tierra).
13. "Higia, me duele mucho el pecho, pide ayuda": avisa a todos los que están al alcance al instante, deja una alerta en el corazón (se ve en la figura) y muestra el aviso de comunicación. Luego "Higia, estoy bien" cancela la alerta.
14. Termina en **Cobertura**: "18 / 18 riesgos de salud de la NASA con detección". **Pantalla completa** la deja sola para proyectar.
15. Para presentar o grabar, cierra el simulador (Esc o D) o usa el **modo grabación** (G): queda solo la interfaz del astronauta.

---

## La interfaz

La interfaz separa **lo que ve el astronauta** del **Simulador**, que hace de sensores, hábitat y tripulación.

### Zonas fijas

| Zona | Qué contiene |
|---|---|
| **Barra superior** | Indicadores de estado (conexión, IA, escucha de «Higia», astronauta, ubicación y destino, hora y, si la hay, tormenta solar), control de voz y botón **Simulador** |
| **Aviso de comunicación** | Aparece cuando Higia se comunicó con otros (alerta sin respuesta o pedido de ayuda): a quién avisó y, en vivo, en qué etapa está cada envío (enviando, entregado, respondió) y a qué hora |
| **Acceso a Higia** | Botón flotante en todas las secciones: estado de la escucha, última respuesta, escribir o dictar |
| **Franja de alerta** | Aparece cuando una alerta espera "Estoy bien": título, cuenta regresiva, botón **Estoy bien** y **Ver detalle**, con una barra que se vacía hasta el plazo. Se ve en cualquier sección y nada la tapa |
| **Barra de reproducción** | Abajo, mientras hay un escenario del simulador: nombre, paso actual con su narración, progreso por pasos, cuenta al siguiente paso, pausa, siguiente, reiniciar, velocidad (×1, ×2, ×4) y cerrar |
| **Navegación** | Barra lateral en escritorio, solo íconos en pantallas medianas, barra inferior en el celular. Mensajes muestra cuántos hay nuevos |

### Secciones

| Sección | Para qué sirve |
|---|---|
| **Higia** (inicio) | El asistente: estado rápido (salud, alertas, última comunicación), botón **Pedir ayuda**, conversación con lo que Higia hizo en cada respuesta, micrófono y el interruptor **Escuchar «Higia»** |
| **Resumen** | **Día de misión**, figura anatómica del cuerpo, **Señales que se suman** (cuando varias señales leves desaconsejan la EVA), lo que **requiere atención** (avisos y alertas activos, de más grave a menos), **Aptitud para tareas** (solo si alguna está desaconsejada) y **sistemas del cuerpo**, que se despliega para ver el detalle. La lista y la figura están sincronizadas |
| **Mensajes** | Todo lo que Higia comunicó. Filtros: Todos, Alertas, Retenidos, Escalados. Cada mensaje muestra nivel, canal, si es privado, retenido o recordatorio, el **riesgo de la NASA** al que responde, a quién se reportó, la guía paso a paso si corresponde y, en los riesgos de semanas, un **minigráfico de tendencia** con la línea base (la radiación, como dosis acumulada frente al límite). **"Por qué este mensaje"** abre el canal elegido, la base científica, el dato técnico y la comparación entre los tres astronautas |
| **Comunicaciones** | Quién está al alcance ahora y todo lo que Higia envió a otros: emergencias y mensajes, automáticos o pedidos al asistente, estado (enviado, en cola, respondió), retardo con Tierra, el texto enviado y la respuesta |
| **Perfil** | Ficha del astronauta e **historia clínica previa** editable: edad, sexo, grupo sanguíneo, alergias, antecedentes (asociables a un sistema del cuerpo), medicación, cirugías, antecedentes familiares y notas |
| **Entorno** | El contexto actual en fichas: ubicación y destino, actividad, clima espacial, hora, día de misión, a quién se puede avisar y canales de salida. Debajo, la **cámara** |
| **Reportes** | Historial de **escaladas** (a quién se avisó y por qué) y envíos a **sistemas médicos**: estado del enlace, cola, enviados y el registro FHIR de cada uno |

### Simulador

Hace lo que en la realidad harían los sensores, el hábitat y la tripulación. Panel lateral con dos tamaños (compacto y **amplio**, con dos columnas) y seis pestañas:

- **Escenarios:** tarjeta **Guion de la demo** ("Reproducir guion"), buscador y filtros por peligro de la NASA, categoría y nivel máximo. Los 40 escenarios van agrupados por categoría, con nivel, riesgos NASA, pasos, duración y la marca "Reproducido". Al abrir uno: qué observar, astronauta sugerido, sus pasos y los botones **Reproducir** y **Paso a paso** (arranca en pausa).
- **Datos:** un control por cada dato del catálogo (50), agrupado por familia y generado desde `INFO_SENSOR`. Cada fila muestra el último valor, la línea base del astronauta (marca en el deslizador) y el nivel actual; el dato se envía al soltar el control. Botones **Día normal** y **Limpiar todo**.
- **Contexto:** semáforo de **aptitud para tareas** (EVA, pilotaje, ejercicio intenso, con los motivos); situación (ubicación, actividad, destino, hora, **día de misión** con atajos 30/180/500, **transición de gravedad**, tormenta solar); **Iniciar EVA** (pide la prerrespiración y emite la duración cada minuto) y **Terminar EVA**; personas, enlaces y dispositivos de salida.
- **Tripulación:** los cuatro astronautas de ejemplo con antecedentes y líneas base; cómo responde el resto (compañero y base, médico, Tierra, demora) y el interruptor de **IA durante los escenarios** (apagado por defecto: cada mensaje sería una consulta).
- **Cobertura:** los **18 riesgos del HRP** en una cuadrícula de cinco columnas (los peligros de la NASA), con su estado en vivo y el contador "18 / 18". Los mosaicos laten al cambiar de estado y se resaltan si el escenario en curso los toca; al tocar uno se ven sus reglas, los escenarios que lo demuestran y la página de la NASA. También hay vista de tabla y **Pantalla completa** para proyectar.
- **Registro:** línea de tiempo de lo que inyectó el simulador y lo que hizo Higia, con el motivo de cada canal. Filtro por tipo y **Copiar como texto**.

El navegador recuerda si el panel quedó abierto, su tamaño y la última pestaña.

**Contexto inicial:** hábitat en la Luna, trabajando, 10:00, día 45 de misión, sin tormenta; pantallas y auricular disponibles; compañero cercano sí; médico a bordo no; sin conexión con el hábitat ni con Tierra.

### Navegación y atajos

- Cada sección tiene su dirección (`#/asistente`, `#/resumen`, `#/mensajes`, `#/comunicaciones`, `#/perfil`, `#/entorno`, `#/reportes`); sin dirección se abre el asistente: funciona el botón "atrás" y se puede compartir un enlace directo. El título de la pestaña cambia con la sección.

| Tecla | Acción |
|---|---|
| **D** | Abre o cierra el simulador (no actúa mientras se escribe) |
| **G** | Modo grabación: oculta el simulador, la barra de reproducción y el cursor quieto, para capturas limpias. G de nuevo para salir |
| **Espacio / N / R** | Con el foco en el simulador o en la barra de reproducción: pausar o continuar, siguiente paso, reiniciar el escenario |
| **← / →** | Cambian de pestaña en el simulador |
| **Esc** | Cierra la pantalla completa o el simulador; si está cerrado, detiene la voz |
| **Tab** | Recorre todo con foco visible; el primer Tab ofrece "Saltar al contenido" |

### Accesibilidad y diseño

- Íconos SVG propios, sin emojis: se ven igual en todos los sistemas.
- Los niveles siempre se muestran con **color y texto**, nunca solo con color.
- Interruptores, pestañas y controles segmentados con roles ARIA; la franja de alerta se anuncia a los lectores de pantalla.
- Tema oscuro tipo consola de misión, diseño responsivo (escritorio, tablet y celular) y respeto por la preferencia de reducir animaciones.
- Movimiento con propósito y sin bucles: el color de la figura cambia con una transición corta, una alerta nueva late dos veces y las tarjetas nuevas entran con un desplazamiento breve. Con la preferencia de reducir animaciones, todo cambia al instante.

---

## Funcionalidades en detalle

### 1. Figura anatómica

Ilustraciones anatómicas 2D del cuerpo (`app/src/ui/FiguraCorporal.tsx`, imágenes en `app/public/cuerpo/`), con dos selectores sobre la figura:

- **Qué mostrar:** Órganos, Músculos o Huesos. En la silueta **solo aparece lo pedido**: la ilustración de esa categoría y sus zonas.
- **Vista:** Frente o Espalda.

La elección se recuerda en el dispositivo. Si se pide un sistema que no está en lo que se ve (por ejemplo, los huesos con la categoría Órganos, o los ojos de espaldas), la figura cambia sola de categoría o de vista.

**Cómo se integran las imágenes:** se muestran sin su fondo oscuro (un filtro SVG convierte la luminancia en transparencia, así que no hace falta editarlas) y se alinean en un lienzo común. Sobre cada una se dibujan sus zonas anatómicas, teñidas con su nivel y **recortadas con la propia figura**, de modo que el color solo cae sobre el cuerpo y el dibujo se sigue viendo.

| Categoría | Zonas (frente) | Zonas (espalda) |
|---|---|---|
| Órganos | Cerebro, ojos, oído interno, tráquea, pulmones, corazón, hígado, estómago, intestinos, ganglios linfáticos | Cerebro, oído interno, tráquea, pulmones, riñones, intestinos, ganglios |
| Músculos | Cuello, hombros (deltoides), pectorales, bíceps, antebrazos, abdominales, cuádriceps, tibial y gemelos | Trapecio, deltoides, dorsales, tríceps, antebrazos, glúteos, isquiotibiales, gemelos |
| Huesos | Cráneo, columna cervical y lumbar, clavículas, esternón, costillas, pelvis, húmeros, radio y cúbito, manos, fémures, rodillas, tibias y peronés, pies | Cráneo, escápulas, columna vertebral, costillas, pelvis y sacro, húmeros, radio y cúbito, manos, fémures, rodillas, tibias, pies |

- **Color = el peor nivel** entre el sistema de la zona (por ejemplo, Huesos) y su **región del cuerpo** (por ejemplo, un golpe en el cráneo tiñe el cráneo): verde normal, azul info, amarillo aviso, rojo alerta; sin datos, sin tinte. Lo que entra en alerta late dos veces y el color de cada zona cambia con una transición corta. **Todo el cuerpo (radiación)** se ve como un halo alrededor de la figura.
- **Interacción:** al pasar el mouse se marca el contorno de la zona; con clic (o Tab y Enter) se selecciona, debajo aparece su nombre, sistema y nivel, y se ve el detalle en la lista **Sistemas del cuerpo**.

### 2. Motor de detección

**36 reglas** (`app/src/core/reglas/`) que cubren los **17 riesgos del HRP** de la NASA más el **tromboembolismo venoso** (catálogo en `app/src/core/riesgosHRP.ts`). Cada regla declara su `fuente` y los riesgos HRP a los que responde (`hrp`). Cada una lee el historial, lo compara con la **línea base personal** cuando aplica y **tiene en cuenta el contexto**. Devuelve un *hallazgo* con: nivel, explicación simple, detalle técnico, acción (que puede variar según la ubicación), guía paso a paso (en alertas), ruta, si es privado, si puede dejar al astronauta incapacitado y de qué anexo sale.

| Riesgo | Sensor | Cómo evalúa (umbrales provisionales) |
|---|---|---|
| Frecuencia cardíaca | `frecuenciaCardiaca` | Respecto a su línea base: +15 lpm → info, +30 → aviso; ≥140 o <40 → alerta. **En ejercicio** el margen sube 60 lpm (máximo 170); **en EVA**, 30 lpm |
| Presión arterial | `presionSistolica` + `presionDiastolica` | Sistólica <90 → aviso, <80 → alerta (posible desmayo); ≥140/90 → aviso, ≥160/100 → alerta |
| Oxígeno (hipoxia) | `spo2` | <95 % → info, <92 % → aviso, <88 % → alerta (posible incapacidad) |
| Sueño | `horasSueno` | Promedio de las últimas 3 noches: <7 h → info, <6 h → aviso |
| Ánimo (privado) | `animo` (1–10) | Caída respecto a su línea base: −2 → aviso, −4 → alerta |
| Estrés (privado) | `estres` (0–100) | ≥60 → aviso, ≥80 → alerta (compatible con crisis de pánico) |
| Ejercicio | `minutosEjercicio` (acumulado del día) | Meta de 90 min/día: <90 → info, <45 → aviso |
| Radiación | `dosisRadiacion` (mSv acumulados) | **Tormenta solar activa**: alerta fuera del hábitat, aviso dentro. Tasa ≥1 mSv/h → alerta. Acumulado: 50 % del límite → info, 80 % → aviso, 100 % → alerta |
| Traumatismo craneal | `impactoCabeza` (g, acelerómetro del casco) + `orientacion` posterior | ≥8 g → info, ≥15 g → aviso, ≥40 g **o** ≥15 g con orientación ≤7/10 después del golpe → alerta (posible incapacidad, región cráneo, guía paso a paso). Tras el golpe, Higia **inicia sola el chequeo de orientación** |
| Desorientación y deterioro cognitivo (privado) | `orientacion` (0–10), `cognicion` (0–100, tipo batería Cognition), `tiempoReaccion` (ms, PVT) | Orientación ≤7 → aviso, ≤4 → alerta. Respecto a su línea base: prueba cognitiva −15 % → aviso, −30 % → alerta; tiempo de reacción +25 % → aviso, +50 % → alerta |
| Posibles síntomas psicóticos (privado) | `marcadoresPsicoticos` (0–10, señales en la conversación) + `horasSueno` + `estres` | ≥3, o ≥1 con sueño <5 h o estrés ≥70 → aviso; ≥6, o ≥4 con sueño bajo **y** estrés alto → alerta (no dejarlo solo, avisar al médico). Sin señales en la conversación no se evalúa: la falta de sueño sola no es psicosis |

La tabla de arriba son las 11 reglas originales. Las 25 nuevas, por riesgo del HRP (detalle y umbrales en `PLAN_RIESGOS_Y_SIMULADOR.md`, §6):

| Riesgo HRP (§) | Reglas nuevas |
|---|---|
| Inmune (7.1.1) | `inmune.fiebre` (fiebre, fiebre sostenida, hipotermia; tolera +0,5 °C en esfuerzo), `inmune.reactivacion` (piel/alergia agravadas por sueño, estrés y radiación) |
| Sensoriomotor (7.1.2) | `vestibular.cinetosis` (esperable en transición de gravedad; en EVA sube a alerta), `vestibular.equilibrio` |
| Cardiovascular (7.1.3) | `cardio.arritmia`; `cardio.presion` ahora usa la transición de gravedad (sistólica <100 ya es aviso) |
| Descompresión (7.1.4) | `descompresion.eva` (ventana de EVA + 24 h, prerrespiración, protocolo textual de regreso) |
| Microorganismos (7.1.5) | `microbioma.entorno` (tendencia de hisopados + síntomas + fiebre) |
| Hipoxia (7.1.6) | `hipoxia.cabina` (ppO₂ de cabina y cuadro de dos síntomas de §7.1.6) |
| Nutrición (7.1.7) | `metabolismo.glucemia`, `nutricion.ingesta`, `nutricion.peso`, `nutricion.hidratacion`, `nutricion.fatigaMenu` |
| EVA (7.1.8) | `eva.carga` (duración, sobreesfuerzo sostenido, calor en el traje) |
| Aptitud (7.1.9) | `musculo.adherencia` (6–7 días/semana), `musculo.aptitud` (10 % esperable, 20 % del documento) |
| SANS (7.1.10) | `sans.vision` (OCT, presión intraocular, agudeza, síntoma) |
| Óseo (7.1.11) | `hueso.perdida`: **estimación** por día de misión × adherencia a la resistencia; osteopenia baja umbrales; calcio urinario sube un nivel |
| Conducta (7.2.1) | `mental.animoSostenido` (tendencia de 7 y 14 días; sin enlace con Tierra propone autocuidado) |
| Equipo (7.2.2) | `equipo.cohesion` (sensible) |
| Sueño (7.2.3) | `sueno.circadiano`, `trabajo.sobrecarga`, `entorno.ruido` |
| Cargas dinámicas (7.2.5) | `lesion.cargaDinamica` (dolor de espalda y hueso debilitado agravan) |
| Radiación (7.3.1) | `radiacion.dosis`: umbral de tasa a la mitad en Luna y Marte, proyección al límite |
| Trombosis (8.2) | `vascular.trombosis` (flujo yugular, asimetría de pantorrilla; con falta de aire, posible embolia) |
| Soporte de sistemas (7.2.4) | Garantía de diseño: toda alerta trae `pasos` (lo verifican los tests) y el escenario `autonomia` |

**Aptitud para tareas críticas.** Los hallazgos declaran qué tareas contraindican (`bloquea`: EVA, pilotaje, ejercicio intenso). `NucleoSalud.aptitudTareas()` las agrega y, si el astronauta sale a EVA o sube al rover con una contraindicación, Higia genera el aviso `tarea.eva` / `tarea.pilotaje` (se borra al volver al hábitat).

**Síntomas como datos.** Lo que cuenta el astronauta se registra como lecturas `sx*` (intensidad 0–10: "un poco" 3, por defecto 5, "mucho" 8, "7 de 10") y las reglas lo cruzan con sensores y contexto. Lo urgente (dolor de pecho, no poder respirar, desmayo, golpe en la cabeza, signos de ACV) sigue siendo alerta inmediata sin depender de reglas.

**Señales que se suman.** Además de las reglas, el núcleo deriva el hallazgo `sistema.senalesCombinadas`: con **4 o más señales leves (info o aviso) en 3 o más sistemas** genera un aviso que desaconseja la EVA (`bloquea: ['eva']`), privado si alguna señal lo es. Se borra solo cuando deja de cumplirse. No suma riesgos HRP propios: en la matriz de cobertura cada riesgo conserva el nivel de su señal. El umbral está en `UMBRAL_SENALES` (`core/nucleo.ts`).

**Caducidad.** Si una regla deja de tener datos vigentes (p. ej. el golpe tiene más de 24 h), su hallazgo se borra; lo contado en la conversación vence a las 24 h.

Para ahorrar energía, cuando llega una lectura **solo se evalúan las reglas que usan ese sensor**. Cuando cambia el contexto, se reevalúan todas. El catálogo de los 50 datos (nombre, unidad, rango, categoría, si se puede decir por voz) está en `app/src/core/sensores.ts`.

**Datos en cada análisis clínico.** Todo hallazgo guarda los datos exactos que usó la regla (sensor, valor, hora, fuente y línea base de la persona). En **Mensajes** cada aviso muestra "Datos usados en este análisis". La IA recibe esos datos, su serie reciente, las líneas base y la historia clínica, y su evaluación debe incluir **"Datos que usó"** (cada dato con su valor) y **"Limitaciones"** (qué falta: por ejemplo, una sola medición o ningún chequeo después de un golpe). Si la IA no cita datos, la app lo advierte.

**Chequeo de orientación.** Cuatro preguntas (nombre, dónde estás, en qué mes estamos y cuánto es veinte menos siete) que Higia hace por voz o texto y evalúa en el dispositivo, sin IA. Mientras dura, las respuestas no necesitan decir "Higia"; "cancela" lo detiene y un pedido de ayuda lo interrumpe. El resultado (4 aciertos = 10/10, 3 = 7, 2 = 5, 1 = 3) entra como dato `orientacion`. Se inicia solo tras un golpe en la cabeza, o al decir "no sé dónde estoy", "estoy confundido" o "hazme un chequeo de orientación".

### 3. Contexto y entorno

| Dato | Valores | Para qué se usa |
|---|---|---|
| Ubicación | hábitat, EVA, rover | Canal (fuera del hábitat: auricular) y acciones específicas |
| Destino | órbita, Luna, Marte | Retardo con Tierra al escalar (órbita <1 s, Luna ~1,3 s, Marte entre 3 y 22 min) |
| Actividad | reposo, trabajo, ejercicio | Evita falsas alarmas de pulso durante el ejercicio |
| Clima espacial | calmo, tormenta solar | Alerta de radiación según dónde esté |
| Hora del hábitat | 00:00–23:00 | Respetar el horario de sueño de cada astronauta |
| Pantallas y auricular | disponibles o no | Elección de canal |
| Compañero cercano | sí/no | Primer destino de una escalada (radio de proximidad, no necesita red) |
| Médico a bordo | sí/no | A quién va un reporte y si se da guía paso a paso |
| Conexión con hábitat / Tierra | sí/no | Envío de reportes y escalada |

**Cámara** (sección Entorno, requiere IA): enciende la webcam y analiza un cuadro, o permite subir una foto. La IA describe el entorno, enumera peligros visibles (persona caída, humo, equipo suelto…) e infiere ubicación, destino y actividad **solo si se ven con claridad**. El botón **"Usar como contexto"** aplica esas inferencias al sistema.

### 4. Cuándo habla Higia

- **Solo habla cuando algo cambia.** Si un riesgo sigue en el mismo nivel, no repite el mensaje. Así se evita la fatiga de alarmas.
- Si el primer dato es normal, no dice nada. Si un riesgo vuelve a la normalidad, solo se actualiza la figura.
- **Recordatorios según la experiencia**, solo para avisos y alertas que siguen activos: novato cada 15 min, intermedio cada 45 min, veterano nunca.
- **Respeta el sueño:** los avisos se retienen durante el horario de sueño del astronauta y se entregan al despertar. Las alertas siempre interrumpen.

### 5. Confirmación y escalada

- Toda **alerta** pide confirmación: aparece la franja roja con **"Estoy bien"** y una cuenta regresiva, y el mismo botón dentro del mensaje.
- Si el astronauta no responde a tiempo, Higia **se comunica con otros**: a los 30 s en general, o a los **15 s** si el riesgo puede dejarlo sin capacidad de pedir ayuda (hipoxia, presión muy baja, pulso extremo). A 10 s del plazo lo advierte por voz, para que pueda responder "Higia, estoy bien".
- Cada destinatario recibe un mensaje con qué pasó, dónde está el astronauta, sus otros hallazgos activos y su **historia clínica** (edad, grupo sanguíneo, alergias, antecedentes, medicación).
- Destinos, del más cercano al más lejano, según lo que esté disponible:
  1. Compañero cercano (radio de proximidad)
  2. Médico de a bordo (si lo hay y si el astronauta no es el médico)
  3. Base más cercana (con conexión al hábitat)
  4. Control en Tierra (con conexión, indicando el retardo según el destino)
  5. Si no hay nadie al alcance: **baliza de emergencia**, que se reintenta al recuperar enlace
- La escalada siempre interrumpe, por voz si hay auricular. Aparece el **aviso de comunicación** (a quién se avisó y su respuesta, en vivo) y queda registrada en **Comunicaciones** y **Reportes**. Sin enlace, el mensaje queda en cola y sale al reconectar.
- El astronauta también puede pedir ayuda en cualquier momento: botón **Pedir ayuda** o "Higia, pide ayuda".

### 6. Personalización por perfil

El mismo hallazgo se redacta distinto para cada astronauta (`app/src/core/personalizador.ts`):

| Rasgo del perfil | Efecto en el mensaje |
|---|---|
| Formación médica: **médico** | Cifras técnicas ("PA 86/56 mmHg") |
| Formación médica: **básica** | Explicación simple + cifras entre paréntesis |
| Formación médica: **ninguna** | Solo la explicación simple, sin números |
| **Propenso al pánico** o tolerancia al estrés **baja** | En temas privados, texto calmado que no nombra el pánico ni el estrés |
| Experiencia **veterano** | Solo la primera oración de la acción (salvo en alertas): no se le repite lo que ya sabe |
| **Ubicación** | Acción específica; por ejemplo, en EVA: "Asegura bien tu arnés y, si puedes, llama a tu compañero." |
| Canal **auricular** | Versión breve: una oración de estado y una de acción |

**Astronautas de ejemplo** (ficticios):

| Nombre | Rol | Formación médica | Experiencia | Estrés |
|---|---|---|---|---|
| Ana Ruiz | Médica de la tripulación | Médica | Veterana | Tolerancia alta |
| Luis Pérez | Ingeniero de sistemas | Ninguna | Novato | Tolerancia baja, propenso al pánico |
| Kai Tanaka | Piloto (aviación experimental) | Básica | Intermedio | Tolerancia alta |

### 7. Elección de canal

`app/src/core/canales.ts` decide por dónde llega cada mensaje, en este orden:

1. **Normal o info** → solo la figura, sin interrumpir.
2. **Aviso durante el horario de sueño** → se retiene hasta que cambie la hora. Las **alertas siempre interrumpen**.
3. **Información privada** → pantalla personal si está en el hábitat, si no auricular. **Nunca la pantalla compartida.** Si no hay canal privado, se retiene.
4. **Fuera del hábitat** (EVA, rover) → auricular, con mensaje breve.
5. **Dentro del hábitat** → pantalla del hábitat (con voz si es alerta); si no hay, pantalla personal; si no, auricular.
6. Sin ningún canal disponible → se retiene hasta que aparezca uno.

Los mensajes retenidos se entregan solos cuando cambia el contexto (al despertar, al volver al hábitat, al aparecer un canal).

### 8. Rutas y médico a bordo

**No siempre hay un médico en la tripulación**, así que Higia no lo da por supuesto:

- **Autogestión:** el astronauta recibe una acción que puede hacer solo.
- **Reporte:** para riesgos que requieren evaluación externa. El hallazgo entra en una cola y se dirige así:
  - **Hay médico a bordo** → se le avisa a él.
  - **Sin médico, con conexión** → equipo médico de la base, o Tierra (con su retardo).
  - **Sin médico ni conexión** → "avisa a un compañero"; el reporte espera en la cola hasta reconectar.
- **Guía paso a paso:** sin médico a bordo, quien no tiene formación médica recibe una guía numerada en las alertas de hipoxia, presión, pulso y estrés.

### 9. Asistente: la base de la app

**Se activa al oír su nombre.** Con **Escuchar «Higia»** encendido (por defecto), Higia escucha de forma continua pero solo actúa cuando la nombran al principio de la frase: "Higia, pide ayuda", "Oye Higia, ¿cómo estoy?". Si solo se dice "Higia", espera la frase siguiente (8 s). Mientras Higia habla no se escucha a sí misma. El botón del micrófono permite dictar una frase sin decir el nombre.

**Puede hacer cosas, no solo responder:**

| Pedido (ejemplo) | Qué hace |
|---|---|
| "Higia, pide ayuda" / "necesito ayuda, llama a la base" | Avisa de inmediato a todos los que están al alcance (o al destino nombrado) y deja una alerta. Sin IA también funciona |
| "Dile a Tierra que terminé la reparación" / "avísale a Kai que voy para allá" | Envía el mensaje; si no hay enlace, queda en cola y sale al reconectar |
| "Me duele el pecho" / "estoy mareado" | Emite una alerta o un aviso nuevo en el sistema del cuerpo que corresponde (se ve en la figura y en Mensajes) |
| "Me golpeé la cabeza con la escotilla" | Aviso en el cráneo y chequeo de orientación |
| "No sé dónde estoy" / "estoy confundido" | Chequeo de orientación (cuatro preguntas evaluadas en el dispositivo) |
| "Oigo voces" / "alguien me vigila" | Registra señales de alteración de la percepción; Higia responde con calma, sin discutir lo que percibe, y la regla decide si avisar al médico |
| "Higia, estoy bien" | Responde a las alertas que esperan confirmación y cancela el aviso a otros |
| "Abre mi historia clínica", "muéstrame el corazón", "silencia la voz" | Navega y controla la app |
| "Salgo a EVA", "empiezo a entrenar" | Actualiza el contexto |
| "Soy alérgico al látex" | Lo agrega a la historia clínica |

Lo urgente (pedir ayuda, "estoy bien", un síntoma grave) lo ejecuta primero el intérprete local, sin esperar a la IA ni depender de la red. La IA solo puede pedir acciones de una lista cerrada, y la app valida cada una antes de ejecutarla.

**Comunicación con otros tras falta de respuesta:** cuando una alerta espera "Estoy bien", a 10 s del plazo Higia lo advierte por voz ("En 10 segundos aviso a…"). Si no hay respuesta, envía a cada destinatario qué pasó, dónde está el astronauta, sus otros hallazgos y su historia clínica (alergias, antecedentes, medicación). El aviso global muestra a quién se comunicó y sus respuestas (simuladas en el simulador, que permite cambiar quién responde).

#### Conversación con IA híbrida

| Situación | Quién responde | Qué entiende |
|---|---|---|
| **Con IA configurada** | IA (DeepSeek-V4.1-Flash, en el servidor del hábitat) | Frases libres ("anoche dormí como cinco horas y me siento cansado"). Responde breve y natural, adaptada al perfil, y **registra los datos que menciona** el astronauta (horas de sueño, ánimo, minutos de ejercicio) |
| **Sin clave, o si la IA falla** | Intérprete local | Palabras clave: "dormí cinco horas", "mi ánimo es 4", "hice 30 minutos de ejercicio", "¿cómo está mi presión?", "¿cómo estoy?" |

- La IA recibe el estado actual (perfil, contexto, hallazgos, últimas lecturas) **sin el nombre del astronauta**. Se le indica no diagnosticar ni inventar datos, y tratar con tacto los temas privados.
- Recuerda los últimos 6 intercambios de la conversación.
- La IA también recibe la historia clínica previa (sin nombre) y el estado de la app (sección, alertas pendientes, comunicaciones, a quién se puede avisar) para poder controlarla.
- Cada respuesta indica si vino de la IA o del intérprete local y, si la IA falló, por qué.
- **Evaluaciones con IA:** cada hallazgo nuevo (aviso, alerta o información) recibe en **Mensajes** una "Evaluación de Higia · IA": qué significa en el contexto actual, cómo se relaciona con el resto del estado y el siguiente paso. El mensaje del motor local sale al instante; la evaluación llega después, así la seguridad nunca espera a la red. No se evalúan escaladas ni recordatorios.

### 10. Voz

En la barra superior: **silenciar o activar** la voz, **pausar y reanudar**, **detener** (también con **Esc**) y **volumen** (se aplica al siguiente mensaje).

- Higia lee en voz alta los mensajes que van al auricular y las respuestas del asistente.
- **Higia habla con una voz neuronal local (Piper)**, generada en el dispositivo y sin conexión: `npm run voz:piper` descarga la voz (`es_MX-claude-high`), el fonemizador y el motor ONNX en `app/public/voz/piper/`. Para empezar a sonar rápido, el texto se parte en oraciones: la primera suena en menos de un segundo y las siguientes se generan mientras tanto.
- Mientras la voz neuronal carga, o si falta o falla, habla la **voz del navegador** (también sin conexión): un mensaje nunca se pierde. Pasando el mouse por el control de voz se ve qué voz está activa.
- Otra voz: `npm run voz:piper -- es_ES-davefx-medium` y `VITE_PIPER_VOZ=es_ES-davefx-medium` en `app/.env.local` (voces en español: `es_MX-claude-high`, `es_MX-ald-medium`, `es_ES-davefx-medium`, `es_ES-sharvard-medium`). `VITE_PIPER=0` la desactiva.
- El reconocimiento de voz tiene **dos motores** y la app elige sola:
  - **Navegador (Web Speech API)**: Chrome y Edge. Es más preciso, pero en Chrome usa servidores de Google y **necesita internet**.
  - **Local (Vosk + WebAssembly)**: Brave, Firefox, Chromium y cualquier navegador compatible. Transcribe **en el dispositivo**, sin enviar el audio a nadie y **sin conexión**. Usa el modelo español grande (`vosk-model-es-0.42`, ~1,4 GB, licencia Apache 2.0).
- El modelo se descarga una vez con `npm run voz:modelo`, se extrae en la primera carga y queda guardado en IndexedDB; después arranca al instante. Ocupa unos 300 MB de memoria mientras escucha.
- Para forzar un motor: `VITE_VOSK_MOTOR=local` (Vosk, también en Chrome, para una demo sin conexión) o `VITE_VOSK_MOTOR=navegador`. `VITE_VOSK_MODELO` permite usar otro modelo. Se configuran en `app/.env.local`.
- Debe abrirse en **localhost o HTTPS**: en una IP de la red local (por ejemplo `http://192.168.1.20:5173`) el navegador bloquea el micrófono.
- Si el audio queda suspendido hasta que haya un gesto, la app pide **tocar la pantalla una vez**.
- El reconocedor escribe «Higia» de muchas formas («hija», «gía», «guía», «y jia», «ilia»…), sobre todo si no se marca la tilde. Al principio de la frase, la app acepta cualquier palabra que **suene** a «Higia» con a lo sumo una letra de diferencia (compara por sonido: la h muda, «gi» y «j» iguales, «y» como «i»). Palabras que solo se le parecen de lejos («día», «tía», «hijo») no la activan.
- **Brave no transcribe con el motor del navegador** (expone la API pero bloquea el servicio de Google); por eso usa Vosk automáticamente.

### 11. Reportes y sistemas médicos (interfaz de ejemplo)

- Cada hallazgo que requiere reporte se convierte a un registro **HL7 FHIR Observation**, un estándar abierto de interoperabilidad clínica.
- Se envía el **identificador** del astronauta (`AST-01`), no su nombre.
- Solo se envía con **Conexión con el hábitat**; al activarla se vacía la cola.
- En **Reportes** se ve el estado del enlace, cuántos hay en cola y enviados, y el registro FHIR de cada envío.
- Es una **interfaz de ejemplo, no una API real de la NASA**. Para conectar un sistema real basta con implementar `AdaptadorExterno` (`app/src/adaptadores/interop/ejemploNasa.ts`).

### Escenarios

**40 escenarios** en `app/src/adaptadores/simulador/escenarios/` (uno por archivo de categoría). Cada uno es una **línea de tiempo** de pasos con narración, contexto, lecturas o una frase del astronauta, y el resultado **esperado** de cada paso. El mismo catálogo es la suite `escenarios.test.ts`. Los 15 originales conservan su `id`:

| Escenario | Qué demuestra |
|---|---|
| Día normal en el hábitat | Todo en verde; también sirve para volver a la normalidad |
| EVA: golpe en la estación | Estrés alto en EVA → mensaje breve por auricular, con la acción del arnés |
| Crisis sin respuesta | Hipoxia grave en EVA → escalada a los 15 s si no responde |
| Sesión de ejercicio | 125 lpm en ejercicio → sin falsa alarma |
| Descenso del ánimo | Dato privado → canal privado |
| Tres noches durmiendo poco | Déficit de sueño acumulado → aviso, no alerta |
| Hipoxia | Alerta con reporte y guía paso a paso |
| Presión baja | Riesgo de desmayo |
| Día sin ejercicio | Contramedida para huesos y músculos |
| Tormenta solar | Clima espacial de tormenta + subida de dosis → al refugio |
| Aviso de madrugada | Aviso retenido a las 03:00; se entrega al cambiar la hora a 08:00 |
| EVA: golpe fuerte en la cabeza | 46 g en el casco → alerta de posible traumatismo craneal, cráneo en rojo en la figura (Huesos) y chequeo de orientación automático |
| Golpe en la cabeza en el hábitat | 18 g → aviso y chequeo; si fallas preguntas, pasa a alerta |
| Desorientación y lentitud | Orientación 6/10, prueba cognitiva y tiempo de reacción peores que la línea base tras noches cortas |
| Señales de alteración de la percepción | Dice oír voces, con poco sueño y estrés alto → alerta sensible de posibles síntomas psicóticos |

Nuevos (25): `fiebre`, `herpes`, `cinetosis-llegada`, `rover-mareo`, `arritmia`, `aterrizaje-desmayo`, `trombo-yugular`, `descompresion`, `descompresion-tardia`, `hipoxia-cabina`, `fatiga-menu`, `hipoglucemia`, `eva-larga`, `fuerza`, `hueso-dia-150`, `sans`, `animo-sostenido`, `conflicto`, `turnos`, `ruido-noche`, `aterrizaje-brusco`, `agua-contaminada`, `tormenta-marte`, `autonomia`, `dia-200`. Qué demuestra cada uno: tabla de la Parte G de `PLAN_RIESGOS_Y_SIMULADOR.md`.

**Guion del pitch** (`GUION_DEMO`): `base` → `descompresion` → `sans` → `animo-sostenido` → `hueso-dia-150` → `autonomia`.

### Tests

`npm test` (214 tests) verifica:

- **Canales:** EVA → auricular; lo privado nunca va a la pantalla compartida; retención durante el sueño; las alertas interrumpen de madrugada.
- **Cuándo habla:** solo cuando cambia algo; recordatorios según la experiencia.
- **Personalización:** texto según el perfil; sin palabras alarmantes para quien es propenso al pánico.
- **Reportes:** a quién van según haya médico o conexión, y cuándo hay guía paso a paso.
- **Escalada:** confirmación, plazos, destinos, baliza y retardo según el destino.
- **Contexto:** ejercicio y tormenta solar.
- **Señales que se suman:** el umbral (4 señales en 3 sistemas), que desaconseja la EVA, que hereda la privacidad y que se borra al normalizarse.
- **Conversación:** el intérprete local registra datos (también números en palabras), síntomas con intensidad y responde consultas.
- **Voz:** variantes con que el reconocedor escribe «Higia» (incluida «guía», típica de Vosk), diagnóstico por navegador y mensajes de error.
- **Reglas** (`core/reglas/*.test.ts`): cada umbral, agravante, `bloquea`, `sensible` y `posibleIncapacidad` de las 36 reglas.
- **Cobertura** (`core/cobertura.test.ts`): los 18 riesgos tienen regla y escenario; todo dato del catálogo lo usa alguna regla.
- **Escenarios** (`adaptadores/simulador/escenarios.test.ts`): los 40 escenarios corren sobre un núcleo real y cumplen su `esperado`; toda alerta trae pasos.
- **Reproductor** (`reproductor.test.ts`): orden, pausa, siguiente, velocidad, espera de escalada y guion, con tiempo falso.

---

## Arquitectura

Todo el código está en `app/`.

```
Sensores / simulador / voz / cámara
          │  Lectura, Contexto
          ▼
┌──────────────────── NÚCLEO AUTÓNOMO (app/src/core) ─────────────────┐
│ reglas/*  → Hallazgo (qué pasa, nivel, ruta, ¿privado?, fuente)     │
│ nucleo.ts → ¿cambió el nivel? · recordatorios · confirmación/escala │
│ personalizador.ts → texto según el perfil                           │
│ canales.ts → pantalla del hábitat / personal / auricular / figura   │
└─────────────────────────────────────────────────────────────────────┘
          │  Mensaje                        │  Reportes            ▲ frases, fotos
          ▼                                 ▼                      │
   Interfaz (app/src/ui) + voz   Sistemas médicos (EJEMPLO)    IA (app/server)
                                 ── con conexión al hábitat ──    ── con clave de API ──
```

**Regla de oro:** `app/src/core` no importa nada de React, del navegador ni de la IA. Corre igual en el traje, en un test o en un servidor. Todo lo que toca el mundo exterior va en `app/src/adaptadores`. La IA está en `app/server` y siempre es opcional.

---

## Estructura del código y reparto del trabajo

```
app/
├── server/                    IA: servidor de desarrollo con la clave (conversación y visión)
├── scripts/                   Descarga del modelo de voz local (npm run voz:modelo)
├── src/
│   ├── core/                  Núcleo autónomo (sin dependencias de UI)
│   │   ├── tipos.ts           Contratos de datos
│   │   ├── sensores.ts        Catálogo de los 50 datos (rango, unidad, categoría)
│   │   ├── riesgosHRP.ts      Los 18 riesgos del HRP (peligros, sistemas, enlaces)
│   │   ├── numeros.ts         Números en palabras → cifras (intérprete local)
│   │   ├── reglas/            36 reglas, agrupadas por área
│   │   ├── nucleo.ts          Orquestación, confirmación y escalada
│   │   ├── personalizador.ts  Texto según el perfil
│   │   ├── canales.ts         Elección de canal
│   │   ├── conversacion.ts    Intérprete local
│   │   └── nucleo.test.ts     Tests
│   ├── adaptadores/
│   │   ├── simulador/         Escenarios (escenarios/), reproductor, registro, tripulación y astronautas
│   │   ├── voz/               Voz neuronal Piper, síntesis del navegador, Web Speech y Vosk local (WASM)
│   │   ├── camara/            Captura de imagen
│   │   ├── ia/                Cliente de la IA y contrato con el servidor
│   │   └── interop/           Exportación FHIR (ejemplo)
│   └── ui/
│       ├── App.tsx            Estado, atajos y estructura
│       ├── simulador/         Panel del simulador (6 pestañas), barra de reproducción, cobertura NASA y useSimulador
│       ├── navegacion.ts      Secciones y direcciones (#/…)
│       ├── iconos.tsx         Íconos SVG
│       ├── componentes/       Barra superior, navegación, franjas de alerta y comunicación, minigráficos, piezas básicas
│       ├── asistente.ts       Estado del asistente: conversación y escucha por «Higia»
│       ├── vistas/            Higia, Resumen, Mensajes, Comunicaciones, Perfil, Entorno, Reportes
│       ├── FiguraCorporal.tsx      Figura anatómica 2D (ilustraciones de app/public/cuerpo + zonas SVG)
│       └── estilos.css        Sistema de diseño
```

| Línea | Carpeta | Qué hay | Pendiente |
|---|---|---|---|
| — | `app/src/core/tipos.ts` | **Contratos de datos.** Avisen antes de cambiarlos. | |
| **A. Detección** | `app/src/core/reglas/` | 36 reglas que cubren los 18 riesgos HRP, con contexto, agravantes y guías paso a paso | Validar umbrales con los anexos y kinesiología |
| **B. Perfil, canales y escalada** | `app/src/core/personalizador.ts`, `canales.ts`, `nucleo.ts` | Texto por perfil, canal, sueño, privacidad, recordatorios, confirmación y escalada | Perfil que aprende del uso |
| **C. Interfaz** | `app/src/ui/` | Navegación por secciones, figura anatómica, simulador, cobertura NASA, minigráficos de tendencia, franjas de alerta, íconos SVG | Vistas dedicadas "pantalla del hábitat" y "auricular" |
| **D. Voz, IA e integración** | `app/src/adaptadores/`, `app/server/` | Web Speech API, **Vosk local (WASM, sin conexión)**, IA híbrida (conversación y visión), FHIR de ejemplo | Detección de «Higia» sin transcribir toda la frase y modelo más preciso |

---

## Cómo extenderlo

### Agregar un riesgo

1. Si necesitas un dato nuevo, agrégalo a `TipoSensor` e `INFO_SENSOR` en `app/src/core/sensores.ts` (con rango y categoría).
2. Crea la regla en `app/src/core/reglas/<area>.ts` con `definirRegla(...)`. Los ayudantes (ventanas, `porDia`, `pendiente`, `factor`, `tieneAntecedente`) están en `reglas/util.ts`.
3. Indica la `fuente` (anexo o tabla del desafío) y los riesgos `hrp`. Sin fuente no hay regla.
4. Toda alerta lleva `pasos`. Si puede dejar al astronauta incapacitado, `posibleIncapacidad: true`. Si contraindica una tarea, `bloquea`.
5. Súmala a `REGLAS` en `app/src/core/reglas/index.ts`.
6. Agrega tests en `app/src/core/reglas/*.test.ts` (ayudantes en `reglas/pruebas.ts`) y un escenario con `esperado` en `app/src/adaptadores/simulador/escenarios/<categoria>.ts`. `cobertura.test.ts` falla si un dato o un riesgo queda sin cubrir.

### Otros cambios frecuentes

| Quiero… | Dónde |
|---|---|
| Agregar un astronauta de ejemplo | `app/src/adaptadores/simulador/perfiles.ts` |
| Agregar un escenario | Un objeto en `app/src/adaptadores/simulador/escenarios/<categoria>.ts` con `pasos` y su `esperado`: aparece solo en el simulador y en los tests |
| Cambiar el guion del pitch | `GUION_DEMO` en `app/src/adaptadores/simulador/escenarios/index.ts` |
| Cambiar cuándo se suman las señales leves | `UMBRAL_SENALES` en `app/src/core/nucleo.ts` |
| Cambiar los nombres cortos de la cuadrícula NASA | `NOMBRE_CORTO_HRP` en `app/src/ui/simulador/cobertura.ts` |
| Cambiar los plazos de "Estoy bien" | `PLAZO_CONFIRMACION_MS` y `PLAZO_CONFIRMACION_INCAPACIDAD_MS` en `app/src/core/nucleo.ts` |
| Cambiar la frecuencia de recordatorios | `intervaloRecordatorioMs` en `app/src/core/personalizador.ts` |
| Cambiar las ilustraciones o ajustar las zonas | Imágenes en `app/public/cuerpo/` (`<vista>-<capa>.jpg`, p. ej. `frente-organos.jpg`); su caja y puntos de referencia en `ILUSTRACIONES` y las zonas en `ZONAS` de `app/src/ui/FiguraCorporal.tsx`; colores en la sección "Figura anatómica 2D" de `estilos.css` |
| Cambiar lo que la IA dice o extrae | Instrucciones y esquemas en `app/server/ia.ts` |
| Conectar un sistema médico real | Implementar `AdaptadorExterno` en `app/src/adaptadores/interop/` |
| Agregar una sección | `SECCIONES` en `app/src/ui/navegacion.ts` y una vista en `app/src/ui/vistas/` |
| Cambiar colores o tipografía | Variables al inicio de `app/src/ui/estilos.css` |

---

## Estado del plan de riesgos y simulador (traspaso)

El plan completo está en [`PLAN_RIESGOS_Y_SIMULADOR.md`](PLAN_RIESGOS_Y_SIMULADOR.md). Se implementó por fases, un commit por fase, con `npm run typecheck` y `npm test` en verde en cada una.

| Fase | Estado | Commit |
|---|---|---|
| 1. Cimientos (catálogo HRP, caducidad, aptitud para tareas, utilidades) | Hecha | `Fase 1: …` |
| 2. Catálogo de datos (50 datos, líneas base, 4.º perfil: comandante Irene Novak) | Hecha | `Fase 2: …` |
| 3. Reglas con datos existentes (fiebre, reactivación, glucemia, radiación, presión) | Hecha | `Fase 3: …` |
| 4. Reglas fisiológicas (C2, C3, C4, C6, C8, C10) | Hecha | `Fase 4: …` |
| 5. Largo plazo y hábitos (C5, C7, C9, C11, C16, C18) | Hecha | `Fase 5: …` |
| 6. Conducta (C12, C13, C14) | Hecha | `Fase 6: …` |
| 7. Conversación e IA (síntomas como lecturas, números en palabras, contrato derivado del catálogo) | Hecha | `Fase 7: …` |
| 8. Motor del simulador (modelo de escenario, reproductor, registro, tripulación, `useSimulador`) | Hecha | `Fase 8: …` |
| 9. Escenarios nuevos (25, total 40) y `cobertura.test.ts` | Hecha | `Fase 9: …` |
| 10. Interfaz del simulador (Parte F, con la capa visual F5) | Hecha | `Fase 10: …` |
| 11. Cierre (README, guion completo y prueba de escalada fantasma) | Hecha | `Fase 11: …` |

### Qué falta (para quien sigue)

**Fase 10 (hecha): qué quedó.** `PanelDemo.tsx` se reemplazó por `ui/simulador/PanelSimulador.tsx` (seis pestañas: Escenarios, Datos, Contexto, Tripulación, Cobertura y Registro; compacto o amplio) y `BarraReproduccion.tsx` (fija abajo mientras hay un escenario). La capa visual para el video (F5):

- **Cobertura** (`CoberturaHRP.tsx`, datos en `cobertura.ts`): cuadrícula de los 18 riesgos en las cinco columnas de peligros, contador animado "18 / 18", mosaicos que laten al cambiar de estado y se resaltan si el escenario en curso los toca, vista de tabla y **pantalla completa** para proyectar.
- **Señales que se suman**: nuevo hallazgo derivado en el núcleo (`sistema.senalesCombinadas`, `senalesQueSeSuman()` en `core/nucleo.ts`): cuatro o más señales leves en tres o más sistemas generan un aviso que desaconseja la EVA. Tarjeta propia en el Resumen, junto a "Día N de misión" y "Aptitud para tareas".
- **Escenario `dia-200`** rehecho (Irene Novak, Luna): 14 noches cortas, ánimo bajo dos semanas, 60 % del límite de radiación y pérdida ósea; termina con la EVA desaconsejada y el aviso al salir.
- **Minigráficos de tendencia** (`componentes/MiniTendencia.tsx`) en el detalle de los mensajes de reglas de largo plazo; la radiación, como barra de dosis acumulada con proyección.
- **Movimiento**: color de la figura con transición, alerta que late dos veces, franja de alerta con barra de plazo, aviso de comunicación con etapas (enviando → entregado → respondió) y hora.
- **Modo grabación (tecla `G`)**: oculta el panel, la barra, el botón Simulador y el cursor quieto.

**Fase 11 (hecha).** README revisado con la interfaz nueva. Se probó con la app corriendo el guion completo y la prueba que pedía el plan: un escenario con escalada pendiente (`crisis`) reiniciado antes de vencer el plazo no produce una escalada ni una respuesta fantasma (el contador de generación de `App.tsx` descarta los temporizadores del núcleo anterior).

**El plan está completo.** Lo que queda fuera de su alcance (rutinas de medición, gráficos históricos completos, vistas dedicadas de pantalla del hábitat y auricular) está en la sección 14 de `PLAN_RIESGOS_Y_SIMULADOR.md`.

### Decisiones tomadas durante la implementación

- `INFO_SENSOR` se movió a `core/sensores.ts` (se reexporta desde `tipos.ts`, los imports no cambian).
- El reinicio crea un núcleo nuevo (como pide el plan) y el reproductor espera 400 ms antes del primer paso para que React termine de instalarlo.
- En el simulador, si un paso produce varios mensajes, solo se lee en voz el de mayor nivel; la evaluación con IA está apagada por defecto.
- Por seguridad, "no puedo mover el brazo / me cuesta hablar" (signos de ACV) y "no puedo respirar" siguen siendo alertas inmediatas además de registrar su lectura `sx*`.
- Umbrales: todos provisionales (los que vienen del documento lo indican en la regla). El criterio de OCT de `sans.vision` está pendiente de verificar contra la fuente oficial.

---

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "IA inactiva" | No hay clave configurada | Crear `app/.env.local` (o `app/.env`) con `DEEPSEEK_API_KEY` y reiniciar `npm run dev` |
| "IA inactiva" aunque haya clave en `.env` | La clave se agregó con la app abierta (la interfaz solo consulta el estado al cargar) o quedó vacía | Recargar la página: la barra superior debe decir **IA activa**. Si no, reiniciar `npm run dev` y comprobar que `http://localhost:5173/api/ia/estado` devuelve `"configurada": true` |
| El asistente dice "IA no disponible (…)" | Error de la API (clave inválida, límite de uso, sin internet) | El mensaje indica el motivo; mientras tanto responde el intérprete local |
| No aparece el botón del micrófono | El navegador no puede capturar audio o la página no está en localhost/HTTPS | Abrir `http://localhost:5173` (no una IP de la red) y comprobar que el navegador permite micrófono; para Vosk hace falta además el modelo descargado |
| El botón del micrófono está, pero no transcribe nada en **Brave/Firefox/Chromium** | Falta el modelo de Vosk o no se pudo descargar | Ejecutar `npm run voz:modelo` en `app/`, recargar y aceptar el micrófono. La app muestra el motivo en la sección Higia |
| "Preparando voz local…" no avanza | El audio está suspendido, el modelo se está extrayendo o faltan permisos | Tocar la pantalla una vez, esperar la primera extracción (~1,4 GB) y revisar la pestaña Red/Consola |
| Vosk muestra `Aborted()` al cargar el modelo grande | El modelo excede la memoria WebAssembly disponible en el navegador | Usar un navegador con más memoria o ejecutar Vosk fuera del navegador; el modelo grande se mantiene configurado |
| Quiero Vosk en Chrome o la demo sin internet | Chrome usa el motor del navegador por defecto | Poner `VITE_VOSK_MOTOR=local` en `app/.env.local` y reiniciar `npm run dev` |
| "Sin micrófono" / Higia no responde a su nombre | Permiso de micrófono denegado, escucha apagada o micrófono no detectado | Revisar el candado de la barra de direcciones, permitir el micrófono para `localhost`, comprobar el micrófono del sistema y encender **Escuchar «Higia»** en la sección Higia |
| La IA no funciona después de `npm run build` | El build estático no incluye el servidor de IA | Usar `npm run dev` para la demo con IA |
| La voz local no funciona después de `npm run build` | Falta el modelo en `dist/` | El build copia `public/voz`; si se borró, volver a ejecutar `npm run voz:modelo` y `npm run build` |
| No se escucha la voz | Voz silenciada o volumen en 0 | Revisar el control de voz de la barra superior |
| "No se pudo acceder a la cámara" | Permiso denegado en el navegador | Habilitar la cámara para `localhost` en la configuración del navegador |
| Higia habla con voz robótica | Falta la voz neuronal o el navegador no permite guardarla | Ejecutar `npm run voz:piper` en `app/` y recargar. El motivo aparece en la consola ("Voz neuronal no disponible…") |

---

## Advertencias

- Los **umbrales son provisionales**: están marcados en cada archivo de reglas y hay que validarlos con los Anexos B, C y F.
- El límite de radiación de 600 mSv (NASA-STD-3001) hay que **verificarlo** antes de citarlo.
- La integración con sistemas médicos es una **interfaz de ejemplo**, no una API real de la NASA.
- Los plazos de escalada (30 s y 15 s) son cortos para la demo; en un sistema real se definirían con criterio médico.
- La IA envía a la API de DeepSeek el estado de salud (sin nombre) y las fotos que se analizan. Cada consulta tiene costo según el uso de la clave.
- El reconocimiento de voz del navegador (Chrome/Edge) usa servidores externos; el motor **Vosk local no envía el audio a ningún lado**. La voz de Higia (Piper) se genera en el dispositivo; la de respaldo usa las voces del sistema.
- El modelo grande de Vosk (~1,4 GB) **no se sube a git**: se descarga con `npm run voz:modelo`. Vosk local requiere bastante memoria mientras escucha.
- Vosk es Apache 2.0 y el modelo español también; se puede usar en la demo sin restricciones.
