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
9. [Solución de problemas](#solución-de-problemas)
10. [Advertencias](#advertencias)

---

## Qué puede hacer Higia

| Capacidad | En una frase |
|---|---|
| **Detectar riesgos** | Ocho reglas basadas en el desafío: pulso, presión, oxígeno, sueño, ánimo, estrés, ejercicio y radiación, comparadas con la línea base de cada astronauta |
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
| **Mostrarlo todo** | Figura anatómica detallada coloreada por estado, mensajes explicados, historial de escaladas y reportes |

---

## Cómo correrlo

**Requisitos:** Node.js 18 o superior. Se recomienda Chrome, porque es el navegador con reconocimiento de voz.

```bash
cd app
npm install
npm run dev        # abre http://localhost:5173
npm test           # tests del núcleo
npm run build      # chequeo de tipos y build de producción
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

La app abre en **Higia**, el asistente. Abre el panel de demo con el botón **Demo** de la barra superior o la tecla **D**. Se abre al costado sin tapar la interfaz, así que el efecto de cada escenario se ve en vivo.

1. **Día normal en el hábitat**: en **Resumen**, la figura se pinta de verde y aparece "Todo en orden".
2. **EVA: golpe en la estación**: llega un mensaje breve por auricular. En **Mensajes**, abre "Por qué este mensaje" para ver el canal elegido, la base científica y cómo lo recibiría cada astronauta.
3. En la pestaña **Astronauta**, cambia a Luis Pérez (novato, propenso al pánico) y repite el escenario: el texto no nombra el pánico.
4. **Sesión de ejercicio**: 125 lpm no dispara alarma, porque el contexto dice que está entrenando.
5. **Descenso del ánimo**: va a la pantalla personal, nunca a la compartida, y se marca como "Privado".
6. **Crisis sin respuesta**: aparece la franja roja arriba, en cualquier sección. No presiones "Estoy bien": a 10 s del plazo Higia advierte por voz que va a avisar a otros, y a los 15 s se comunica con el compañero cercano. Aparece el aviso de comunicación con su respuesta en vivo; el detalle (con la historia clínica enviada) queda en **Comunicaciones**.
7. **Aviso de madrugada**: queda retenido. En **Contexto**, cambia la hora a 08:00 y se entrega.
8. En **Contexto**, apaga **Médico a bordo** y ejecuta **Hipoxia**: aparece la guía paso a paso.
9. Activa **Conexión con el hábitat**: se vacía la cola de reportes (**Reportes**) y sale lo que estaba en cola en **Comunicaciones**.
10. En **Higia**, di (o escribe) "Higia, anoche dormí como cinco horas y me siento cansado": registra el dato. Con clave, mira la **Evaluación de Higia · IA** en cada mensaje.
11. "Higia, dile a Tierra que terminé la reparación": el mensaje aparece en **Comunicaciones** (en cola si no hay enlace con Tierra).
12. "Higia, me duele mucho el pecho, pide ayuda": avisa a todos los que están al alcance al instante, deja una alerta en el corazón (se ve en la figura) y muestra el aviso de comunicación. Luego "Higia, estoy bien" cancela la alerta.
13. En **Perfil**, revisa la historia clínica de cada astronauta; prueba "Higia, soy alérgico al látex" para agregar un dato hablando.
14. Para presentar, cierra el panel de demo (Esc o D): queda solo la interfaz del astronauta.

---

## La interfaz

La interfaz separa **lo que ve el astronauta** de **los controles de la demo**.

### Zonas fijas

| Zona | Qué contiene |
|---|---|
| **Barra superior** | Indicadores de estado (conexión, IA, escucha de «Higia», astronauta, ubicación y destino, hora y, si la hay, tormenta solar), control de voz y botón **Demo** |
| **Aviso de comunicación** | Aparece cuando Higia se comunicó con otros (alerta sin respuesta o pedido de ayuda): a quién avisó y, en vivo, si ya respondió |
| **Acceso a Higia** | Botón flotante en todas las secciones: estado de la escucha, última respuesta, escribir o dictar |
| **Franja de alerta** | Aparece cuando una alerta espera "Estoy bien": título, cuenta regresiva, botón **Estoy bien** y **Ver detalle**. Se ve en cualquier sección y nada la tapa |
| **Navegación** | Barra lateral en escritorio, solo íconos en pantallas medianas, barra inferior en el celular. Mensajes muestra cuántos hay nuevos |

### Secciones

| Sección | Para qué sirve |
|---|---|
| **Higia** (inicio) | El asistente: estado rápido (salud, alertas, última comunicación), botón **Pedir ayuda**, conversación con lo que Higia hizo en cada respuesta, micrófono y el interruptor **Escuchar «Higia»** |
| **Resumen** | Figura anatómica del cuerpo, lista de lo que **requiere atención** (avisos y alertas activos, de más grave a menos) y lista de **sistemas del cuerpo**, que se despliega para ver el detalle. La lista y la figura están sincronizadas |
| **Mensajes** | Todo lo que Higia comunicó. Filtros: Todos, Alertas, Retenidos, Escalados. Cada mensaje muestra nivel, canal, si es privado, retenido o recordatorio, a quién se reportó y la guía paso a paso si corresponde. **"Por qué este mensaje"** abre el canal elegido, la base científica, el dato técnico y la comparación entre los tres astronautas |
| **Comunicaciones** | Quién está al alcance ahora y todo lo que Higia envió a otros: emergencias y mensajes, automáticos o pedidos al asistente, estado (enviado, en cola, respondió), retardo con Tierra, el texto enviado y la respuesta |
| **Perfil** | Ficha del astronauta e **historia clínica previa** editable: edad, sexo, grupo sanguíneo, alergias, antecedentes (asociables a un sistema del cuerpo), medicación, cirugías, antecedentes familiares y notas |
| **Entorno** | El contexto actual en fichas: ubicación y destino, actividad, clima espacial, hora, a quién se puede avisar y canales de salida. Debajo, la **cámara** |
| **Reportes** | Historial de **escaladas** (a quién se avisó y por qué) y envíos a **sistemas médicos**: estado del enlace, cola, enviados y el registro FHIR de cada uno |

### Panel de demo

Simula lo que en la realidad harían los sensores y el hábitat. Tiene tres pestañas:

- **Escenarios:** once situaciones listas para ejecutar (ver [Escenarios](#escenarios)). El último ejecutado queda marcado.
- **Astronauta:** tres perfiles de ejemplo. Cambiar de astronauta no altera la detección, solo cómo se le comunica.
- **Contexto**, agrupado en:
  - **Situación:** ubicación, actividad, destino, hora y tormenta solar.
  - **Personas:** compañero cercano y médico a bordo.
  - **Enlaces:** conexión con el hábitat y con Tierra.
  - **Dispositivos de salida:** pantalla del hábitat, pantalla personal y auricular.

El navegador recuerda si el panel quedó abierto.

**Contexto inicial:** hábitat en la Luna, trabajando, 10:00, sin tormenta; pantallas y auricular disponibles; compañero cercano sí; médico a bordo no; sin conexión con el hábitat ni con Tierra.

### Navegación y atajos

- Cada sección tiene su dirección (`#/asistente`, `#/resumen`, `#/mensajes`, `#/comunicaciones`, `#/perfil`, `#/entorno`, `#/reportes`); sin dirección se abre el asistente: funciona el botón "atrás" y se puede compartir un enlace directo. El título de la pestaña cambia con la sección.

| Tecla | Acción |
|---|---|
| **D** | Abre o cierra el panel de demo (no actúa mientras se escribe) |
| **Esc** | Cierra el panel de demo; si está cerrado, detiene la voz |
| **Tab** | Recorre todo con foco visible; el primer Tab ofrece "Saltar al contenido" |

### Accesibilidad y diseño

- Íconos SVG propios, sin emojis: se ven igual en todos los sistemas.
- Los niveles siempre se muestran con **color y texto**, nunca solo con color.
- Interruptores, pestañas y controles segmentados con roles ARIA; la franja de alerta se anuncia a los lectores de pantalla.
- Tema oscuro tipo consola de misión, diseño responsivo (escritorio, tablet y celular) y respeto por la preferencia de reducir animaciones.

---

## Funcionalidades en detalle

### 1. Figura anatómica

Ilustraciones anatómicas 2D del cuerpo (`app/src/ui/FiguraCorporal.tsx`, imágenes en `app/public/cuerpo/`), con dos selectores sobre la figura:

- **Vista:** Frente o Espalda.
- **Capa:** Órganos, Músculos o Esqueleto.

La elección se recuerda en el dispositivo. Si se pide un sistema que no se ve desde la vista actual (por ejemplo, los ojos de espaldas), la figura se gira sola.

**Cómo se integran las imágenes:** se muestran sin su fondo oscuro (un filtro SVG convierte la luminancia en transparencia, así que no hace falta editarlas) y se alinean en un lienzo común. Sobre ellas se dibuja la zona de cada sistema, teñida con su nivel y **recortada con la propia figura**, de modo que el color solo cae sobre el cuerpo y el dibujo se sigue viendo. Las zonas se definen una vez por vista y se trasladan a cada ilustración con sus puntos de referencia (mentón, hombros, entrepierna, rodillas y brazos), porque cada dibujo tiene proporciones algo distintas.

| Sistema | Zona (frente) | Zona (espalda) |
|---|---|---|
| Cerebro / mente | Cráneo | Cráneo |
| Ojos | Ojos | (no visible: se gira a frente) |
| Oído interno | A cada lado de la cabeza | A cada lado de la cabeza |
| Pulmones | Pulmones | Pulmones |
| Corazón y vasos | Corazón | (no visible: se gira a frente) |
| Metabolismo | Hígado y estómago | Riñones |
| Intestino | Intestino | Intestino |
| Huesos | Pelvis y rodillas | Columna, pelvis y rodillas |
| Sistema inmune | Ganglios del cuello, axilas e ingle | Ganglios del cuello |
| Músculos | Brazos | Brazos |
| Piernas | Piernas | Piernas |
| Todo el cuerpo (radiación) | Halo de toda la figura | Halo de toda la figura |

- **Color = el peor nivel** entre los riesgos activos de ese sistema: verde normal, azul info, amarillo aviso, rojo alerta; sin datos, sin tinte. Lo que está en alerta pulsa suavemente.
- **Interacción:** al pasar el mouse se marca el contorno de la zona y aparece su nombre y nivel; con clic (o Tab y Enter) se selecciona y se ve su detalle en la lista **Sistemas del cuerpo**. Lo seleccionado queda resaltado. Un clic en el resto de la figura selecciona **Todo el cuerpo**.

### 2. Motor de detección

Ocho reglas, una por riesgo (`app/src/core/reglas/`). Cada una lee el historial, lo compara con la **línea base personal** cuando aplica y **tiene en cuenta el contexto**. Devuelve un *hallazgo* con: nivel, explicación simple, detalle técnico, acción (que puede variar según la ubicación), guía paso a paso (en alertas), ruta, si es privado, si puede dejar al astronauta incapacitado y de qué anexo sale.

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

Para ahorrar energía, cuando llega una lectura **solo se evalúan las reglas que usan ese sensor**. Cuando cambia el contexto, se reevalúan todas.

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
| "Higia, estoy bien" | Responde a las alertas que esperan confirmación y cancela el aviso a otros |
| "Abre mi historia clínica", "muéstrame el corazón", "silencia la voz" | Navega y controla la app |
| "Salgo a EVA", "empiezo a entrenar" | Actualiza el contexto |
| "Soy alérgico al látex" | Lo agrega a la historia clínica |

Lo urgente (pedir ayuda, "estoy bien", un síntoma grave) lo ejecuta primero el intérprete local, sin esperar a la IA ni depender de la red. La IA solo puede pedir acciones de una lista cerrada, y la app valida cada una antes de ejecutarla.

**Comunicación con otros tras falta de respuesta:** cuando una alerta espera "Estoy bien", a 10 s del plazo Higia lo advierte por voz ("En 10 segundos aviso a…"). Si no hay respuesta, envía a cada destinatario qué pasó, dónde está el astronauta, sus otros hallazgos y su historia clínica (alergias, antecedentes, medicación). El aviso global muestra a quién se comunicó y sus respuestas (simuladas en la demo).

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
- La síntesis de voz funciona sin conexión, con las voces del sistema.
- El reconocimiento de voz (micrófono) usa el del navegador; en Chrome depende de servidores de Google, así que **todavía no es autónomo**.

### 11. Reportes y sistemas médicos (interfaz de ejemplo)

- Cada hallazgo que requiere reporte se convierte a un registro **HL7 FHIR Observation**, un estándar abierto de interoperabilidad clínica.
- Se envía el **identificador** del astronauta (`AST-01`), no su nombre.
- Solo se envía con **Conexión con el hábitat**; al activarla se vacía la cola.
- En **Reportes** se ve el estado del enlace, cuántos hay en cola y enviados, y el registro FHIR de cada envío.
- Es una **interfaz de ejemplo, no una API real de la NASA**. Para conectar un sistema real basta con implementar `AdaptadorExterno` (`app/src/adaptadores/interop/ejemploNasa.ts`).

### Escenarios

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

### Tests

`npm test` (21 tests sobre el núcleo) verifica:

- **Canales:** EVA → auricular; lo privado nunca va a la pantalla compartida; retención durante el sueño; las alertas interrumpen de madrugada.
- **Cuándo habla:** solo cuando cambia algo; recordatorios según la experiencia.
- **Personalización:** texto según el perfil; sin palabras alarmantes para quien es propenso al pánico.
- **Reportes:** a quién van según haya médico o conexión, y cuándo hay guía paso a paso.
- **Escalada:** confirmación, plazos, destinos, baliza y retardo según el destino.
- **Contexto:** ejercicio y tormenta solar.
- **Conversación:** el intérprete local registra datos y responde consultas.

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
├── src/
│   ├── core/                  Núcleo autónomo (sin dependencias de UI)
│   │   ├── tipos.ts           Contratos de datos
│   │   ├── reglas/            Una regla por riesgo
│   │   ├── nucleo.ts          Orquestación, confirmación y escalada
│   │   ├── personalizador.ts  Texto según el perfil
│   │   ├── canales.ts         Elección de canal
│   │   ├── conversacion.ts    Intérprete local
│   │   └── nucleo.test.ts     Tests
│   ├── adaptadores/
│   │   ├── simulador/         Escenarios y astronautas de ejemplo
│   │   ├── voz/               Síntesis y reconocimiento de voz
│   │   ├── camara/            Captura de imagen
│   │   ├── ia/                Cliente de la IA y contrato con el servidor
│   │   └── interop/           Exportación FHIR (ejemplo)
│   └── ui/
│       ├── App.tsx            Estado, atajos y estructura
│       ├── navegacion.ts      Secciones y direcciones (#/…)
│       ├── iconos.tsx         Íconos SVG
│       ├── componentes/       Barra superior, navegación, franja de alerta, panel de demo, piezas básicas
│       ├── asistente.ts       Estado del asistente: conversación y escucha por «Higia»
│       ├── vistas/            Higia, Resumen, Mensajes, Comunicaciones, Perfil, Entorno, Reportes
│       ├── FiguraCorporal.tsx      Figura anatómica 2D (ilustraciones de app/public/cuerpo + zonas SVG)
│       └── estilos.css        Sistema de diseño
```

| Línea | Carpeta | Qué hay | Pendiente |
|---|---|---|---|
| — | `app/src/core/tipos.ts` | **Contratos de datos.** Avisen antes de cambiarlos. | |
| **A. Detección** | `app/src/core/reglas/` | 8 reglas con contexto y guías paso a paso | Validar umbrales con los anexos; agregar huesos, temperatura, glucemia, vestibular |
| **B. Perfil, canales y escalada** | `app/src/core/personalizador.ts`, `canales.ts`, `nucleo.ts` | Texto por perfil, canal, sueño, privacidad, recordatorios, confirmación y escalada | Perfil que aprende del uso |
| **C. Interfaz** | `app/src/ui/` | Navegación por secciones, figura anatómica, panel de demo, franja de alerta, íconos SVG | Gráficos de tendencia, vistas dedicadas "pantalla del hábitat" y "auricular" |
| **D. Voz, IA e integración** | `app/src/adaptadores/`, `app/server/` | Web Speech API, IA híbrida (conversación y visión), FHIR de ejemplo | Reconocimiento de voz local (Vosk o whisper.cpp) |

---

## Cómo extenderlo

### Agregar un riesgo

1. Crea la regla en `app/src/core/reglas/<area>.ts` con `definirRegla(...)`. `respiratorio.ts` es un ejemplo corto.
2. Indica la `fuente` (anexo o tabla del desafío). Sin fuente no hay regla.
3. Si la alerta puede dejar al astronauta incapacitado, marca `posibleIncapacidad: true`. Agrega `pasos` para cuando no hay médico a bordo.
4. Súmala a `REGLAS` en `app/src/core/reglas/index.ts`.
5. Agrega un escenario en `app/src/adaptadores/simulador/escenarios.ts` y un test en `app/src/core/nucleo.test.ts`.

### Otros cambios frecuentes

| Quiero… | Dónde |
|---|---|
| Agregar un astronauta de ejemplo | `app/src/adaptadores/simulador/perfiles.ts` |
| Cambiar los plazos de "Estoy bien" | `PLAZO_CONFIRMACION_MS` y `PLAZO_CONFIRMACION_INCAPACIDAD_MS` en `app/src/core/nucleo.ts` |
| Cambiar la frecuencia de recordatorios | `intervaloRecordatorioMs` en `app/src/core/personalizador.ts` |
| Cambiar las ilustraciones o ajustar las zonas | Imágenes en `app/public/cuerpo/` (`<vista>-<capa>.jpg`, p. ej. `frente-organos.jpg`); su caja y puntos de referencia en `ILUSTRACIONES` y las zonas en `ZONAS` de `app/src/ui/FiguraCorporal.tsx`; colores en la sección "Figura anatómica 2D" de `estilos.css` |
| Cambiar lo que la IA dice o extrae | Instrucciones y esquemas en `app/server/ia.ts` |
| Conectar un sistema médico real | Implementar `AdaptadorExterno` en `app/src/adaptadores/interop/` |
| Agregar una sección | `SECCIONES` en `app/src/ui/navegacion.ts` y una vista en `app/src/ui/vistas/` |
| Cambiar colores o tipografía | Variables al inicio de `app/src/ui/estilos.css` |

---

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "IA inactiva" | No hay clave configurada | Crear `app/.env.local` (o `app/.env`) con `DEEPSEEK_API_KEY` y reiniciar `npm run dev` |
| El asistente dice "IA no disponible (…)" | Error de la API (clave inválida, límite de uso, sin internet) | El mensaje indica el motivo; mientras tanto responde el intérprete local |
| No aparece el botón del micrófono | El navegador no tiene reconocimiento de voz | Usar Chrome |
| "Sin micrófono" / Higia no responde a su nombre | Permiso de micrófono denegado o escucha apagada | Permitir el micrófono para `localhost` y encender **Escuchar «Higia»** en la sección Higia |
| No se escucha la voz | Voz silenciada o volumen en 0 | Revisar el control de voz de la barra superior |
| "No se pudo acceder a la cámara" | Permiso denegado en el navegador | Habilitar la cámara para `localhost` en la configuración del navegador |
| La IA no funciona después de `npm run build` | El build estático no incluye el servidor de IA | Usar `npm run dev` para la demo con IA |

---

## Advertencias

- Los **umbrales son provisionales**: están marcados en cada archivo de reglas y hay que validarlos con los Anexos B, C y F.
- El límite de radiación de 600 mSv (NASA-STD-3001) hay que **verificarlo** antes de citarlo.
- La integración con sistemas médicos es una **interfaz de ejemplo**, no una API real de la NASA.
- Los plazos de escalada (30 s y 15 s) son cortos para la demo; en un sistema real se definirían con criterio médico.
- La IA envía a la API de DeepSeek el estado de salud (sin nombre) y las fotos que se analizan. Cada consulta tiene costo según el uso de la clave.
- El reconocimiento de voz del navegador (Chrome) usa servidores externos. La síntesis de voz sí funciona sin conexión.
