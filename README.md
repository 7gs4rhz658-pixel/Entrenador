# Mi Entrenador Personal 🏋️

App multi-cliente para un entrenador personal: cada cliente tiene su cuenta,
su rutina de 8 semanas con progresión ondulada, su nutrición con macros y su
seguimiento; el entrenador ve y edita todo desde su panel. Mobile-first, en
español (Argentina).

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind · Supabase
(Postgres + Auth + Row Level Security) · Groq o Gemini (IA, opcional) · Open Food
Facts · Vercel.

## Qué hace

### Cliente
- **Alta:** registro con correo → cuestionario (datos corporales, objetivo,
  experiencia, días, tiempo, equipamiento, lesiones) → pago (checkout
  **simulado**, con ruta a pago real en `src/lib/pagos.ts`) → la IA genera el
  plan inicial (o una plantilla si la IA no está configurada).
- **Semana:** dashboard con la semana del bloque, la fase del ciclo, el estado
  de cada día y la comida de hoy.
- **Comenzar rutina:** modo guiado ejercicio por ejercicio y serie por serie;
  al registrar cada serie arranca solo el **cronómetro de descanso**
  (configurable por ejercicio y ajustable por serie con −15/+15), con sonido
  y vibración. Muestra el **peso de la semana pasada** por serie.
- **Registro clásico:** cada día con steppers grandes, RIR/al fallo, "Todo
  según plan", series extra, navegación entre semanas.
- **Progresión ondulada de 4 semanas** (`src/lib/progression.ts`):
  - Fase 1: piso del rango de reps (ej. 10) al peso base.
  - Fase 2: mismo peso, tope del rango (15).
  - Fase 3: sube el peso, vuelve al piso.
  - Fase 4: descarga al 50 %.
  - Ciclo siguiente: arranca con el peso de la fase 3, no el original.
  - Al cerrar la semana, la **IA sugiere el peso concreto** de cada ejercicio
    mirando reps/kg/RIR registrados (acotado a ±15 % de la regla y al
    incremento del equipo). Sin IA vale la regla. La nota queda visible en el
    ejercicio.
- **Nutrición:** calorías y macros (proteína/carbos/grasa) según objetivo
  (déficit, mantenimiento, superávit) y día de entreno/descanso; registro de
  comidas por momento; buscador de alimentos sobre una base USDA + **Open Food
  Facts** (se cachea en la base); **sustitución de ingredientes** ("cambiar
  frutos rojos por manzana") con la cantidad calculada por regla de tres para
  mantener calorías, proteína o carbos; **recetas con IA** dentro de los
  macros restantes.
- **Progreso:** gráfico por ejercicio del mejor peso (o reps) por semana.
- **Perfil:** datos, objetivo y cuestionario editables.

### Entrenador
- **Panel** con todos los clientes: objetivo, bloque y semana, último entreno,
  pendientes (cuestionario, pago, sin plan).
- **Ficha de cliente:** resumen de la semana y cuestionario, **rutina
  editable** (mismo editor que el cliente), progreso, comida del día, cerrar
  semana / nuevo bloque, marcar pago, dar de baja.
- **Reemplazo total por `.txt`:** pegar o subir el plan escrito a mano → la IA
  lo interpreta → vista previa → confirmar. Reemplaza la rutina completa y
  conserva el historial.
- **Regenerar plan** desde el cuestionario (IA o plantilla).

### Seguridad
- Supabase Auth (correo + contraseña). Cada fila lleva `user_id` y **RLS**
  garantiza que un cliente solo ve y toca lo suyo; el entrenador (rol
  `entrenador`) ve todo. La app usa solo la clave pública (anon): no hay
  service_role en ningún lado.
- El rol lo decide un trigger al registrarse: correos listados en la tabla
  `entrenadores` → entrenador; el resto → cliente. Un cliente no puede
  cambiarse el rol (trigger).
- La clave de la IA (Groq o Gemini) vive solo en el servidor (server actions).

---

## Puesta en marcha

### 1. Supabase
1. Creá un proyecto en [supabase.com](https://supabase.com).
2. SQL Editor → pegá y corré `supabase/migrations/0001_esquema.sql`.
3. Editá `supabase/migrations/0002_seed.sql`: reemplazá el correo de la tabla
   `entrenadores` por el tuyo (el correo con el que vas a registrarte como
   entrenador). Pegalo y corrélo.
4. SQL Editor → pegá y corré `supabase/migrations/0003_recomendacion_comidas.sql`
   (menú de comidas, cuestionario nutricional, descargo) y después
   `supabase/migrations/0004_asistente.sql` (asistente de situaciones) y
   `supabase/migrations/0005_checkins.sql` (check-in semanal e informe) y
   `supabase/migrations/0006_ajuste_macros.sql` (ajuste quincenal) y
   `supabase/migrations/0007_pago_vence.sql` (vencimiento del mes) y
   `supabase/migrations/0008_mensajes_push_referidos.sql` (mensajes, push, referidos) y
   `supabase/migrations/0009_revision_entrenador.sql` (borradores hasta que el entrenador envía) y
   `supabase/migrations/0010_medidas.sql` (medidas corporales) y
   `supabase/migrations/0011_sesiones_entreno.sql` (duración de sesiones) y
   `supabase/migrations/0012_fotos_progreso.sql` (fotos de progreso: bucket privado + índice) y
   `supabase/migrations/0013_records.sql` (récords personales) y
   `supabase/migrations/0014_plantillas_rutina.sql` (plantillas de rutina) y
   `supabase/migrations/0015_protocolos_checklist.sql` (checklist de Hoy y protocolos del entrenador) y
   `supabase/migrations/0016_alimentos_mx_y_fases.sql` (alimentos de México con sinónimos, comidas
   pre/post-entreno, fases del protocolo y lecturas de la IA guardadas) y
   `supabase/migrations/0017_menu_borrador.sql` (menú enviado y borrador a la vez).
5. Authentication → Providers → Email: recomendado **desactivar "Confirm
   email"** (el SMTP gratuito manda muy pocos correos por hora). Si lo dejás,
   la app muestra la pantalla "Confirmá tu correo".
5. Project Settings → API: anotá **Project URL** y la clave **anon**
   (o **publishable**).

### 2. IA (opcional pero recomendado)
Groq: clave gratis sin tarjeta en [console.groq.com/keys](https://console.groq.com/keys)
→ `GROQ_API_KEY`. Alternativa: Gemini en [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
→ `GEMINI_API_KEY`. Se usa el primero que esté configurado.
Sin ella: plan por plantilla, progresión por regla, sin recetas ni lectura de
`.txt`.

### 3. Local
```bash
cp .env.example .env.local   # y completá los valores
npm install
npm run dev
```
Abrí `http://localhost:3000` → "Empezá acá" → registrate con el correo de
entrenador → panel. Registrá un segundo correo como cliente para probar el
flujo completo (tarjeta de prueba: cualquier número, ej. 4111 1111 1111 1111;
una que termine en 0002 simula un rechazo).

### 4. GitHub + Vercel
```bash
git init && git add -A && git commit -m "Mi Entrenador Personal"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/mi-entrenador.git
git push -u origin main
```
En Vercel: importar el repo, cargar `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` y `GROQ_API_KEY` (o `GEMINI_API_KEY`), Deploy. Las páginas que
llaman a la IA declaran `maxDuration = 60`. Opcionales: `TZ_APP` (zona horaria,
por defecto `America/Mexico_City`) y `PLAN_PRECIO_USD` (precio del mes en dólares,
por defecto 50; el pago sigue siendo simulado).

Avisos al teléfono (opcional): `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
(`npx web-push generate-vapid-keys`), `VAPID_SUBJECT`, `CRON_SECRET` y
`SUPABASE_SERVICE_ROLE_KEY` (solo la usa el cron diario de `vercel.json`, que corre
sin usuario). El cliente los activa en Perfil.

> La skill `/publicar` (carpeta `.claude/skills/publicar/`) guía todo esto
> paso a paso desde Claude Code, pensada para quien no programa.

---

## Comandos

```bash
npm run dev               # desarrollo local
npm run build             # build de producción
npm run typecheck         # verificación de tipos
npm run test              # motor de progresión + planes/nutrición
npm run test:rls          # aislamiento RLS en vivo (pasar 4 args: cliente pass entrenador pass)
```

## Estructura

```
src/
  middleware.ts           refresca la sesión de Supabase y protege rutas
  app/
    login, registro, confirmar
    (onboarding)/         cuestionario · pago (checkout simulado + plan inicial)
    (app)/                cliente: semana, dia/[id] (+ /entrenar), nutricion,
                          progreso, rutina, perfil
    (entrenador)/         panel: clientes · [id] (resumen, rutina, progreso,
                          comida, plan .txt)
    actions/              server actions: auth, onboarding, entreno, rutina,
                          perfil, nutricion, entrenador
  components/             UI (Entrenar, ExerciseLogger, RestTimer, RutinaDia,
                          NutricionDia, AgregarComida, Sustituir, Recetas,
                          PlanTxt, ProgresoCliente, ...)
  lib/
    supabase/             clientes SSR (server + middleware)
    auth.ts               sesión, requireCliente / requireEntrenador
    data.ts               consultas (todas por user_id)
    progression.ts        motor ondulado de 4 semanas (puro, testeado)
    plan-service.ts       cerrar semana, recalcular, nuevo bloque (+ IA)
    plan-generator.ts     normalizar plan de la IA · plantilla sin IA (puro)
    plan-import.ts        escribir un plan en la base
    ai.ts                 proxy IA Groq/Gemini (plan, .txt, ajustes, sustitución, recetas)
    ai-comidas.ts         IA de la recomendación de comidas (menú, .txt, batch cooking)
    ai-asistente.ts       asistente de situaciones (fiesta, restaurante, falta X, viaje…)
    ai-informe.ts         borrador del informe semanal (el entrenador lo aprueba)
    stats.ts              adherencia de la semana y resumen numérico para el informe
    ajuste-macros.ts      ajuste quincenal de kcal por tendencia de peso (el entrenador confirma)
    ai-mensajes.ts        borrador de mensaje del entrenador al cliente
    avisos.ts             aviso diario ("mañana te toca" + pendientes) para push
    push.ts               envío Web Push (VAPID); cron en app/api/cron/avisos
    meal-plan.ts          recomendación de comidas: sanear, cuadrar, compras, avisos, batch
    meal-plan-db.ts       resolver ingredientes contra la base y escribir/leer el menú
    comidas-service.ts    orquesta IA/.txt → resolver → cuadrar → aplicar
    descargo.ts           aviso legal de las recomendaciones de comida
    nutrition.ts          TMB, macros por objetivo, regla de tres
    off.ts                Open Food Facts + caché en `ingredients`
    pagos.ts              checkout simulado (punto de cambio a pago real)
supabase/migrations/      0001 esquema + RLS · 0002 seed (entrenador, ingredientes) · 0003 recomendación de comidas · 0004 asistente · 0005 check-ins · 0006 ajuste de macros · 0007 vencimiento del pago · 0008 mensajes, push y referidos · 0009 revisión del entrenador · 0010 medidas · 0011 sesiones · 0012 fotos · 0013 récords · 0014 plantillas · 0015 checklist y protocolos · 0016 alimentos de México, pre/post-entreno y fases · 0017 menú en borrador
scripts/                  tests: progresión, planes/nutrición, RLS
```

## Preguntas frecuentes

**¿Cómo agrego otro entrenador?** SQL Editor:
`insert into entrenadores (email) values ('correo@...');` antes de que se
registre. Si ya se registró: `update profiles set rol = 'entrenador' where
email = 'correo@...';`.

**¿Cómo paso a cobrar de verdad?** Reemplazá `procesarPago` en
`src/lib/pagos.ts` por Mercado Pago Checkout Pro o Stripe Checkout y marcá
`estado_pago = 'pagado'` desde el webhook del proveedor. El resto de la app
solo mira `profiles.estado_pago`.

**¿De dónde salen los macros de los alimentos?** De la tabla `ingredients`:
~55 valores de referencia de USDA FoodData Central (seed) y todo lo que se
busca en Open Food Facts (se guarda con su código de barras). La IA nunca
inventa macros: solo interpreta pedidos y sugiere recetas.

**¿Los cambios en una semana cerrada?** Si editás lo realizado de una semana
ya cerrada, la siguiente se recalcula sola (mientras no esté cerrada también).

**¿Puedo cambiar la rutina a mitad de bloque?** Sí (cliente desde Rutina,
entrenador desde el panel): los cambios aplican a la semana actual y la
progresión sigue desde ahí.
