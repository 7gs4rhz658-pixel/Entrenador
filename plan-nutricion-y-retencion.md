# Plan: Nutrición prescrita + asistente de situaciones + retención mensual

Fecha: 2026-09-19 · Estado: propuesta, pendiente de aprobación de EVER.

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

Añadir un paso al `CuestionarioForm` existente: comidas por día (3–6), horario de entreno, alergias/intolerancias, alimentos que no come, si cocina o come fuera, presupuesto (bajo/medio/alto), país (para nombres y disponibilidad). Sin esto la dieta por IA sale genérica; con esto sale "suya".

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

### 3.5 Lista de compras semanal
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

## 4. Orden de implementación propuesto

| Fase | Qué | Esfuerzo | Por qué en este orden |
|---|---|---|---|
| **1** | Módulo A completo (tablas, IA + .txt, vista previa entrenador, "Hoy te toca" + "La comí" cliente, cuestionario nutricional) | grande | Es lo pedido y la base de todo lo demás |
| **2** | Módulo B asistente de situaciones + `asistente_logs` | medio | Usa el contexto de la fase 1; es el diferencial que más se va a usar a diario |
| **3** | Check-in semanal + informe IA aprobado por EVER + adherencia visible | medio | Primer gancho de retención; reutiliza `week_closures` |
| **4** | Lista de compras + ajuste automático de macros quincenal | chico | Barato y de uso semanal |
| **5** | Informe de fin de mes + `pago_vence_at` + bloqueo suave + recordatorios de renovación | medio | Cierra el ciclo mensual de cobro |
| **6** | Push, mensajes con borradores IA, detección de abandono, referidos | medio | Cuando haya clientes reales que retener |
| — | Pago real (Mercado Pago) | medio | Cuando haya 3+ clientes pagando |

Publicar en Vercel **después de la fase 1** (o antes, con lo que hay), no esperar a todo: cada fase se despliega sola con un `git push`.

## 5. Riesgos y cómo se cubren

- **Límite de Groq (8k tok/min, 1k req/día)**: prompts compactos, generar por día, cachear el plan. 1.000 req/día alcanza para ~40 clientes activos con uso normal. Si crece, `GROQ_MODEL=openai/gpt-oss-20b` (límites más altos) o segundo proveedor de respaldo.
- **Macros inventados por la IA**: se evita por diseño (1.1, regla de oro).
- **Datos de salud**: ya están bajo RLS; los logs del asistente también. No se mandan a la IA nombre ni email, solo datos del perfil físico.
- **No es consejo médico**: aviso corto; alergias e intolerancias del cuestionario se pasan como restricciones duras al prompt.

## 6. Decisiones que necesito de EVER antes de la fase 1

1. **Estructura del plan de comidas**: ¿"día de entreno" + "día de descanso" (2 menús, más simple y realista) o 7 días distintos?
2. **Comidas por día**: ¿fijas en 4 (desayuno, almuerzo, merienda, cena) + snack opcional, o lo elige el cliente en el cuestionario? (Propongo: lo elige el cliente, 3 a 6.)
3. **¿Quién puede editar la dieta aplicada?** Propongo: solo EVER; el cliente sustituye ingredientes (ya existe) pero no reescribe el plan.
4. **Formato del .txt de dieta**: ¿tenés un ejemplo real de cómo las escribís? Con uno o dos ejemplos tuyos ajusto el prompt a tu estilo.
