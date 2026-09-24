# Plan: Nutrición prescrita + asistente de situaciones + retención mensual

Fecha: 2026-09-19 · Estado: **fases 1 a 6 implementadas y verificadas end-to-end (2026-09-19/20)**; **ronda 2 (ajustes tras probar como cliente) implementada y verificada (2026-09-20/21)**. Publicado en Vercel: https://entrenador-rho.vercel.app (deploy automático con cada `git push`). Pendiente más adelante: el pago real (Mercado Pago).

## Qué quedó hecho (resumen)

| Fase | Estado | Dónde |
|---|---|---|
| 1 Recomendación de comidas (IA + .txt), Hoy/Mañana te toca, compras, batch cooking, descargo | ✓ | migración 0003, `lib/meal-plan*.ts`, `ai-comidas.ts` |
| 2 Asistente de situaciones | ✓ | migración 0004, `ai-asistente.ts`, `Asistente.tsx` |
| 3 Check-in semanal + informe aprobado por el entrenador + adherencia | ✓ | migración 0005, `stats.ts`, `ai-informe.ts` |
| 4 Ajuste quincenal de kcal | ✓ | migración 0006, `ajuste-macros.ts` |
| 5 Tu mes + vencimiento del pago + bloqueo suave | ✓ | migración 0007, `/mes`, `pagos.ts` |
| 6 Mensajes con borradores IA, abandono, push (PWA + cron), referidos | ✓ | migración 0008, `push.ts`, `avisos.ts`, `ai-mensajes.ts` |
| — Pago real (Mercado Pago) | pendiente | `pagos.ts` (mock) |

### Ronda 2 — ajustes tras probar la app como cliente (2026-09-20/21)

| # | Ajuste | Estado | Dónde |
|---|---|---|---|
| 1 | Rutina y menú quedan **en borrador** hasta que el entrenador los revisa y los **envía**; al pagar ya no se genera nada solo, el cliente ve "tu entrenador está armando tu plan" | ✓ | migración 0009, `PendienteEnviar.tsx`, `PlanTxt.tsx`, `actions/entrenador.ts` |
| 2 | **Medidas corporales** (cuello, hombros, pecho, cintura, cadera, brazos relajados/contraídos, antebrazos, muslos, pantorrillas) con comparación, gráfica e integración en informe y mes | ✓ | migración 0010, `lib/medidas.ts`, `MedidasForm.tsx`, `MedidasHistorial.tsx` |
| 3 | **Cronómetro** de tiempo total al comenzar la rutina; duración guardada por sesión y promedio en progreso/informe | ✓ | migración 0011, `Entrenar.tsx`, `guardarSesion` |
| 4 | "Ideas para lo que te queda" propone **una receta por cada comida pendiente** del cliente (antes faltaba la cena) | ✓ | `sugerirRecetas(momentos)`, `Recetas.tsx`, `NutricionDia.tsx` |
| 5 | **Fotos de progreso** privadas (frente/perfil/espalda) con antes/después | ✓ | migración 0012, bucket `fotos`, `FotosForm.tsx`, `FotosGaleria.tsx` |
| 6 | **Récords personales** automáticos al registrar una serie (🏆 en el momento, historial y en el informe) | ✓ | migración 0013, `detectarRecord`, `getRecords` |
| 7 | **Plantillas de rutina** del entrenador (guardar la de un cliente, cargarla en otro) | ✓ | migración 0014, `actions/plantillas.ts`, `planDesdeRutina` |
| 8 | Panel **"Hoy"** del entrenador: nuevos sin plan, informes listos, mensajes, check-ins, caídos, pagos por vencer, quién entrena hoy | ✓ | `(entrenador)/entrenador/page.tsx` |

### Ronda 3 — ideas de NutriGoo: "Hoy" como checklist y protocolos (2026-09-23)

| # | Qué | Estado | Dónde |
|---|---|---|---|
| 1 | **Hoy como checklist ordenado por hora**: comidas (se registran con un toque), entreno, agua y protocolo; % del día, racha (días ≥ 70 %), tira de 14 días, "Ahora" | ✓ | migración 0015 (`checklist_dia`), `lib/hoy.ts`, `lib/hoy-db.ts`, `ChecklistHoy.tsx` |
| 2 | **Protocolos del entrenador por segmentos** (suplementos, hábitos, cara, cabello, sueño…): momento del día relativo al horario del cliente, días, semanas de progresión, "por qué", "fuera del protocolo"; borrador → enviar; `/protocolo` del cliente; cumplimiento por área en la ficha, el informe y el panel Hoy | ✓ | migración 0015 (`protocolos`, `protocolo_items`), `lib/protocolo*.ts`, `ProtocoloEditor.tsx` |
| 3 | **Importar el plan en texto**: la IA ubica cada cosa en su momento sin recomendar nada (suplemento que no está en el texto → descartado; lo con calorías → menú), horarios del texto al cuestionario del cliente, "pasar las comidas al menú" | ✓ | `lib/ai-protocolo.ts`, `ProtocoloTxt.tsx` |

Notas: los horarios del texto quedan en el cuestionario del cliente (editable en "Cómo comes"), no en `meal_plans.horarios`; esa columna de la migración 0015 quedó sin uso. Avisos push a la hora de cada ítem: pendiente (el plan gratis de Vercel permite un solo cron diario). Siguiente: el juego de antojos (`plan-antojos-gamificacion.md`) usando el % diario del checklist como motor de puntos; su migración pasa a ser la 0016.

No verificado en local: la entrega real de notificaciones push (requiere teléfono + claves en Vercel + `SUPABASE_SERVICE_ROLE_KEY`); sí se verificó el service worker, la suscripción, la ruta del cron con su protección y el contenido del aviso (`/api/avisos/preview`).

Nota de despliegue: Vercel bloquea los deploys automáticos si el email del commit no pertenece a la cuenta de GitHub conectada (`BLOCKED`, "Git author must have access"). El repo usa el email *noreply* de GitHub de la cuenta (`git config user.email`) para que cada `git push` despliegue solo.

## Decisiones tomadas (2026-09-19)

1. Estructura: **menú de día de entreno + menú de día de descanso** (no 7 días distintos).
2. Comidas por día: **las elige el cliente** en el cuestionario nutricional (3 a 6).
3. Edición: **solo EVER** edita la dieta aplicada; el cliente sustituye ingredientes, no reescribe.
4. No hay `.txt` de ejemplo: el intérprete se hace **tolerante a cualquier formato** (listas, tablas, "150g pollo + 80g arroz", con o sin días/momentos) y se prueba con varios estilos.
5. **Enfoque en la experiencia del cliente**: el problema de los PDF es que hay que estar mirando qué toca mañana. La app debe **anticiparse** (sección 1.6): a la noche muestra qué toca mañana, sugiere batch cooking y arma la lista de compras.
6. **Marco legal**: todo lo nutricional se presenta como **recomendaciones / orientación del entrenador**, nunca como "plan elaborado por nutricionista" (sección 7). Esto cambia textos, nombres de pantallas y agrega un descargo aceptado en el onboarding.
7. Solo se agrega lo que **aporta valor real**: las ideas de retención quedan priorizadas (sección 4); nada se implementa "porque sí".

## 0. Punto de partida (lo que ya existe y se reutiliza)

| Pieza | Estado | Se reutiliza para |
|---|---|---|
| `profiles` (edad, sexo, peso, altura, actividad, objetivo, `cuestionario` jsonb) | listo | fórmula de macros, contexto de la IA |
| `ingredients` (USDA + Open Food Facts + manual) | listo | cada comida del plan referencia un ingrediente real → macros reales, no inventados |
| `meal_logs` (lo que el cliente comió, por momento del día) | listo | "marcar comida como hecha" = insertar meal_logs |
| `objetivosDiarios()` en `lib/nutrition.ts` | listo | meta diaria (kcal/prot/carb/grasa) que el plan debe cumplir |
| `lib/ai.ts` → `generarJSON()` con Groq | listo | todas las funciones nuevas de IA son 1 prompt + 1 esquema JSON cada una |
| Flujo `.txt` de rutina (`PlanTxt.tsx` → interpretar → vista previa → aplicar) | listo | mismo patrón exacto para la dieta |
| `estado_pago` / `activo` en perfil, `pagos.ts` (mock) | listo | recurrencia mensual |
| `manifest.ts` (PWA instalable) | listo | notificaciones push (fase 2) |

Restricción a respetar: el plan gratis de Groq da **8.000 tokens/minuto**. Un plan de comidas de 7 días completo en una sola llamada puede rozar ese límite. Solución: generar **por día** (7 llamadas cortas encoladas) o un "día tipo entreno" + "día tipo descanso" y replicar. Se decide en la implementación midiendo tokens reales.

---

## 1. Módulo A — Plan de comidas prescrito (vía IA y vía .txt)

### 1.1 Modelo de datos (migración `0003_plan_comidas.sql`)

```
meal_plans
  id, user_id, nombre, origen ('ia'|'txt'|'manual'), activo bool,
  notas text, created_at
meal_plan_days
  id, meal_plan_id, tipo ('entreno'|'descanso'|'dia_semana'), dia_semana int null (1..7)
meal_plan_items
  id, meal_plan_day_id, momento (desayuno|almuerzo|merienda|cena|snack),
  orden int, nombre_plato text, ingredient_id → ingredients, cantidad_g numeric,
  nota text (ej. "cocido", "sin aceite")
profiles (nuevos campos)
  macros_manual jsonb null   -- si el entrenador fija kcal/prot/carb/grasa a mano, pisa la fórmula
  cuestionario_nutricion jsonb null  -- preferencias, alergias, comidas/día, horarios, cocina sí/no, presupuesto
```

- Un plan activo por cliente. Aplicar uno nuevo desactiva el anterior (queda historial).
- RLS igual que el resto: el cliente lee lo suyo; el entrenador todo.
- **Regla de oro**: la IA nunca inventa macros. Propone `nombre_ingrediente` + gramos; el servidor **resuelve cada nombre contra `ingredients`** (búsqueda local → Open Food Facts → si no existe, lo marca "sin macros" para que EVER lo revise en la vista previa). Los números del plan salen de la tabla, no del modelo.

### 1.2 Funciones de IA nuevas (`lib/ai.ts`)

| Función | Entrada | Salida |
|---|---|---|
| `generarPlanComidas(perfil, objetivos, cuestionarioNutricion, base)` | macros meta día entreno y día descanso, preferencias/alergias, comidas por día, lista de ingredientes base | día entreno + día descanso con platos, ingredientes y gramos que **cuadran ±5 %** con la meta |
| `interpretarDietaTxt(texto, perfil)` | dieta escrita a mano por EVER (días, comidas, "150 g pollo, 80 g arroz…") | mismo JSON; temperatura 0.1, "no inventes comidas" |
| `ajustarPlanComidas(planActual, delta)` (fase 1.5) | "subí 200 kcal en carbos los días de entreno" | plan modificado, solo cambia lo pedido |

Post-proceso determinista (sin IA): resolver ingredientes, recalcular macros reales, y si el total se desvía >5 % de la meta, **escalar los carbohidratos** (arroz/avena/pan/fruta) para cuadrar. Así el plan siempre cierra en números aunque el modelo se pase.

### 1.3 Panel del entrenador (ficha de cliente → pestaña "Comida")

1. **Objetivos**: muestra los calculados por fórmula; botón "Fijar a mano" (kcal + macros) → `macros_manual`.
2. **Generar dieta con IA** → vista previa editable (cambiar gramos, quitar/agregar plato, cambiar ingrediente con buscador) → "Aplicar".
3. **Cargar dieta .txt** → mismo flujo que la rutina: pegar/subir → interpretar → vista previa → aplicar.
4. **Ver adherencia**: por día, qué comidas marcó, qué cambió, qué comió fuera del plan.

### 1.4 App del cliente (pestaña Nutrición)

- Arriba: **"Hoy te toca"** (según sea día de entreno o descanso): desayuno, almuerzo… con cada plato y sus gramos.
- Cada comida: botón **"✓ La comí"** → inserta `meal_logs` con esos ingredientes (suma a las barras de macros ya existentes). Botón **"Cambiar"** → abre el sustituidor actual (ya funciona con IA).
- Lo que come fuera del plan lo registra como hoy (buscador libre). Las barras muestran meta vs. real.
- Mantener la vista libre para quien no tiene plan asignado (no rompe nada existente).

### 1.5 Cuestionario nutricional en el onboarding

Añadir un paso al `CuestionarioForm` existente: comidas por día (3–6) y a qué hora aproximada cada una, horario de entreno, alergias/intolerancias (restricción dura), alimentos que no come, si cocina o come fuera, si puede cocinar en tandas (batch cooking) y qué día, presupuesto (bajo/medio/alto), país (para nombres y disponibilidad). Sin esto la recomendación por IA sale genérica; con esto sale "suya". Al final del paso: aceptación del descargo (sección 7).

### 1.6 La app se anticipa: "Mañana", batch cooking y lista de compras

Es la diferencia con un PDF: el cliente no tiene que buscar qué toca. Todo esto es **determinista** (sale de las tablas, sin IA) salvo donde se indica.

**a) "Mañana te toca"** — en la pantalla de inicio, a partir de las 18:00 (`TZ_APP`) aparece una tarjeta con el día siguiente:
- Entreno o descanso, y si entrena: qué día de la rutina ("Pierna, 6 ejercicios, ~55 min").
- Las comidas del menú que corresponde (entreno/descanso), en el orden y horarios del cliente.
- **Preparación para mañana**: avisos derivados del menú, generados por reglas simples sobre los ingredientes: "sacá el pollo del freezer", "dejá la avena remojando", "llevá el tupper del almuerzo si comés fuera". Sin push en la fase 1: la tarjeta está ahí cuando abre la app; el push (fase 2) llevará este mismo contenido.
- El mismo bloque sirve para "Hoy te toca" durante el día.

**b) Batch cooking semanal** — el domingo (o el día que eligió en el cuestionario) la app muestra "Cociná una vez para la semana":
- Cálculo determinista: suma los ingredientes de ambos menús × cantidad de días de entreno y descanso de esa semana (salen de `training_days`) → "Pollo 1,4 kg, arroz 560 g crudo (≈1,6 kg cocido), batata 1,2 kg…".
- Agrupa por técnica (horno / hervido / plancha) y estima el tiempo total.
- Con IA (una llamada corta, opcional): orden de cocción para que todo entre en ~1,5 h y cómo conservar (heladera 3–4 días, freezer el resto). Se guarda y se reutiliza mientras no cambie el plan.
- Cada comida del plan referencia si viene "del batch" para que "Mañana te toca" diga "ya está cocinado, solo calentar".

**c) Lista de compras** — derivada del mismo cálculo: ingredientes × 7 días, en gramos y en unidades prácticas ("huevos 14", "pollo 1,4 kg", "avena 1 paquete"). Se marca lo que ya tiene, se comparte por WhatsApp (texto) con un botón. Se regenera sola si EVER cambia el plan.

Tablas: no hace falta ninguna nueva para a) y c); para b) se guarda el resultado en `meal_plans.batch_cooking jsonb`.

---

## 2. Módulo B — Asistente de situaciones ("hoy tengo una fiesta")

Un chat de una sola pregunta, con **todo el contexto del día** metido en el prompt (meta del día, lo que ya comió, lo que le queda, su plan de hoy, sus preferencias). El cliente escribe en lenguaje natural y la IA responde con un plan concreto y accionable.

Casos que cubre el mismo prompt (se detecta la intención en el JSON de salida):

| Situación | Ejemplo del cliente | Respuesta esperada |
|---|---|---|
| **Evento / fiesta** | "Hoy tengo un cumpleaños, va a haber asado, pizza y torta" | Qué comer del evento y cuánto (ej. "2 porciones de vacío ~250 g, 1 porción de pizza, una porción chica de torta"), cómo **reacomodar el resto del día** (desayuno/almuerzo más livianos, priorizar proteína) y un mensaje de tranquilidad: un día no rompe nada |
| **Restaurante** | "Estoy en una parrilla / sushi / hamburguesería" | 2–3 opciones ordenadas que mejor entren en lo que le queda |
| **No tengo X** | "No tengo pollo, tengo atún y huevos" | Reemplazo con gramos equivalentes (usa `gramosEquivalentes` real) |
| **Antojo** | "Quiero algo dulce" | Opción que entra en los macros restantes o cómo "hacer lugar" |
| **Viaje / sin cocina** | "Estoy de viaje 3 días" | Guía de supermercado/kiosco/comida rápida para esos días |
| **Me salí del plan** | "Ayer comí de más" | Ajuste suave (no castigo): mantener el plan, agua, entreno normal; opcional −10 % carbos hoy |

Detalles de diseño:
- Respuesta en JSON (`{ resumen, que_comer: [...], reacomodo_dia: [...], mensaje }`) para renderizarla bonita, no un muro de texto.
- Botón **"Aplicar al día"**: si la IA propone reacomodo, reescribe el "Hoy te toca" de ese día (no toca el plan base).
- Guardar cada consulta en `asistente_logs` → EVER ve en la ficha qué le preguntan sus clientes (insight para su coaching, y contenido para responder personalmente cuando importa).
- Las respuestas se etiquetan como orientación de un entrenador, no consejo médico (banner corto en la primera vez).
- **Fotos de menú/plato** (visión): Groq no tiene modelo de visión en tu cuenta hoy; Gemini sí (cuando esté en Free Tier). Se deja preparada la interfaz y se activa cuando haya proveedor con visión. Mientras tanto, texto.

---

## 3. Retención y recurrencia mensual (lo que hace que paguen el mes siguiente)

Principio: el cliente renueva cuando **ve progreso**, **siente que alguien lo mira** y **la app le resuelve la vida diaria**. Cada idea apunta a uno de los tres.

### 3.1 Check-in semanal + informe automático (el gancho principal)
- Domingo (o al cerrar la semana, que ya existe `week_closures`): la app pide **peso, cintura opcional, foto opcional, energía 1–5, sueño 1–5, adherencia percibida**.
- La IA cruza eso con los datos reales (series registradas, comidas marcadas, macros promedio, evolución de cargas) y redacta un **informe corto y personal**: "Subiste 2,5 kg en press banca y 5 kg en sentadilla, cumpliste 3/3 entrenos y 81 % de comidas. El peso bajó 0,4 kg: en línea con el objetivo. Esta semana: sumar 20 g de proteína en la merienda."
- EVER recibe el informe en su panel, **lo aprueba o lo edita en 30 segundos** y sale al cliente "de parte de EVER". El cliente siente coaching humano con esfuerzo mínimo de tu lado. Esto es lo que ningún genérico (MyFitnessPal, Hevy) hace.

### 3.2 Ajuste automático de macros cada 2 semanas
- Con la tendencia de peso (media móvil de 7 días) y el objetivo: si en déficit no baja → −100/150 kcal; si en volumen no sube → +150 kcal. Lo propone la app, EVER confirma con un clic. El plan de comidas se re-escala solo (regla de carbos de 1.2).
- Esto es coaching real; hoy los macros son fijos desde el registro.

### 3.3 Informe de fin de mes = momento de renovación
- Al cumplir 4 semanas: página "Tu mes" con antes/después: cargas por ejercicio (gráfica ya existe), peso, medidas, fotos lado a lado, adherencia, y un párrafo de la IA aprobado por EVER con el plan para el mes siguiente.
- El recordatorio de pago va **pegado a ese informe**, no aislado: "Este mes lograste X. El próximo bloque arranca el lunes → renovar".
- Vencido el pago: **bloqueo suave** (puede ver su historial y su rutina de hoy, pero no genera nuevo bloque ni recibe informe) + recordatorio a los 3 y 7 días. `estado_pago` ya existe; falta `pago_vence_at`.

### 3.4 Adherencia visible, sin gamificación barata
- Semana actual: anillo "3/3 entrenos · 18/21 comidas". Racha de semanas cumplidas. Hitos de fuerza ("primera vez 100 kg en sentadilla") que se guardan y aparecen en el informe.
- Nada de monedas ni confeti; adultos que pagan quieren ver números que suben.

### 3.5 Lista de compras semanal (movida a la fase 1, ver 1.6c)
- Derivada del plan de comidas activo: agrupa ingredientes × 7 días, en gramos y en unidades prácticas ("pollo 1,1 kg", "huevos 14"). Un botón, se comparte por WhatsApp. Muy barato de hacer y se usa todas las semanas → hábito.

### 3.6 Recordatorios (PWA push)
- "Hoy: pierna, 6 ejercicios" a la hora que el cliente elija; "no registraste el almuerzo"; "domingo: check-in de 1 minuto". Web Push funciona en Android e iOS (app instalada). Fase 2 porque requiere service worker + tabla de suscripciones + envío desde el servidor (cron de Vercel).

### 3.7 Mensajes entrenador → cliente dentro de la app
- Hilo simple por cliente. Lo importante: **la IA prepara borradores** ("Juan lleva 2 entrenos sin registrar, ¿le escribo?") y EVER envía con un toque. Escala: 30 clientes atendidos con la calidad de 5.

### 3.8 Detección de abandono
- Si un cliente no registra nada en 4 días: aparece arriba en el panel de EVER con un botón "Escribirle" (borrador listo). Recuperar a tiempo vale más que cualquier feature.

### 3.9 Referidos
- "Traé un amigo: los dos tienen 15 % el mes siguiente". Código en el perfil; EVER lo aplica a mano al principio (no hace falta automatizar el pago).

### 3.10 Pago real recurrente
- `pagos.ts` es mock. Para Argentina: **Mercado Pago Suscripciones** (débito automático mensual con tarjeta) o link de pago mensual + confirmación manual de EVER. Stripe si hay clientes fuera del país. Se decide cuando haya clientes reales; la app ya está preparada con `estado_pago`.

---

## 4. Orden de implementación (cerrado)

Criterio: entra en la fase 1 lo que el cliente usa **todos los días**; lo que se usa una vez por semana o por mes va después; lo que solo sirve con clientes reales, al final.

| Fase | Qué | Esfuerzo | Valor para el cliente |
|---|---|---|---|
| **1** | Módulo A: tablas, recomendación por IA + .txt, vista previa editable para EVER, cuestionario nutricional, **"Hoy / Mañana te toca"** con "✓ La comí" y avisos de preparación, **lista de compras**, **batch cooking**, textos y descargo legal (sección 7) | grande | Deja de mirar el PDF: la app le dice qué comer, qué preparar y qué comprar |
| **2** | Módulo B: asistente de situaciones (fiesta, restaurante, no tengo X, antojo, viaje, me pasé) + `asistente_logs` | medio | Resuelve el día real, que nunca es el del plan |
| **3** | Check-in semanal + informe IA aprobado por EVER + adherencia visible (anillos, racha, hitos) | medio | Siente que alguien lo mira; ve progreso |
| **4** | Ajuste automático de macros quincenal (EVER confirma) | chico | Coaching real, no macros fijos |
| **5** | Informe de fin de mes + `pago_vence_at` + bloqueo suave + recordatorio de renovación | medio | Cierra el ciclo mensual |
| **6** | Push (PWA) con el contenido de "Mañana te toca", mensajes con borradores IA, detección de abandono, referidos | medio | Cuando haya clientes reales que retener |
| — | Pago real (Mercado Pago) | medio | Cuando haya 3+ clientes pagando |

Publicar en Vercel **al terminar la fase 1**; cada fase siguiente se despliega sola con `git push`.

### 4.1 Fase 1 en detalle (lo que se ejecuta con la autorización)

1. Migración `0003_plan_comidas.sql`: `meal_plans`, `meal_plan_days`, `meal_plan_items`, campos nuevos en `profiles` (`macros_manual`, `cuestionario_nutricion`, `acepto_descargo_at`), RLS, aplicada en Supabase por MCP.
2. `lib/ai.ts`: `generarRecomendacionComidas()` e `interpretarDietaTxt()`; `lib/meal-plan.ts`: resolver ingredientes, cuadrar macros, calcular compras y batch cooking.
3. Onboarding: paso nutricional + descargo.
4. Panel entrenador, pestaña "Comida": objetivos (fórmula / a mano), generar con IA, cargar .txt, vista previa editable, aplicar, ver adherencia.
5. App cliente: "Hoy te toca" / "Mañana te toca" en inicio y nutrición, "✓ La comí", "Cambiar", lista de compras, batch cooking.
6. Pruebas end-to-end con usuarios de prueba (se borran al final), `tsc` y `next build` limpios, commit y push.

## 5. Riesgos y cómo se cubren

- **Límite de Groq (8k tok/min, 1k req/día)**: prompts compactos, generar por día, cachear el plan. 1.000 req/día alcanza para ~40 clientes activos con uso normal. Si crece, `GROQ_MODEL=openai/gpt-oss-20b` (límites más altos) o segundo proveedor de respaldo.
- **Macros inventados por la IA**: se evita por diseño (1.1, regla de oro).
- **Datos de salud**: ya están bajo RLS; los logs del asistente también. No se mandan a la IA nombre ni email, solo datos del perfil físico.
- **No es consejo médico**: aviso corto; alergias e intolerancias del cuestionario se pasan como restricciones duras al prompt.

## 6. Decisiones — resueltas (ver arriba, "Decisiones tomadas")

## 7. Marco legal: recomendaciones, no plan de nutricionista

Todo lo nutricional se presenta como **orientación del entrenador basada en referencias generales**, no como prescripción dietética profesional. Se aplica en tres capas:

**a) Lenguaje en toda la app** (cliente y entrenador):
- "Recomendación de comidas" en vez de "Plan de dieta" / "Dieta". "Te recomendamos" en vez de "Tenés que". "Referencia diaria" en vez de "Objetivo prescrito".
- La IA recibe la instrucción de redactar como entrenador ("sugerencia", "podés"), nunca como profesional de la salud, y de no dar indicaciones sobre enfermedades, medicación ni suplementos.

**b) Descargo aceptado una vez** (en el paso nutricional del onboarding, con `acepto_descargo_at` guardado con fecha):
> Las recomendaciones de alimentación de esta app son orientación general de tu entrenador basada en referencias nutricionales públicas (USDA, Open Food Facts) y en los datos que cargaste. No son un plan elaborado por un nutricionista ni reemplazan una consulta médica. Si tenés una condición de salud, embarazo, trastorno alimentario o tomás medicación, consultá con un profesional antes de seguirlas.

- Se muestra también en el pie de la pantalla de nutrición y en la primera respuesta del asistente de situaciones (fase 2), en versión corta con enlace al texto completo.

**c) Restricciones duras**: alergias e intolerancias del cuestionario se pasan a la IA como prohibiciones y, además, el post-proceso determinista rechaza cualquier ingrediente que coincida con ellas (no depende del modelo).

Nota: esto es una medida de prudencia razonable, no asesoría legal. Si EVER va a cobrar a escala, conviene que un abogado revise el texto del descargo y los términos del servicio.
