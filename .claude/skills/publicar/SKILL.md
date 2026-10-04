---
name: publicar
description: >-
  Guía paso a paso, pensada para personas que NO saben programar, para poner
  online su propia copia de la app "Mi Entrenador Personal" (multi-cliente:
  entrenador + clientes con cuenta propia). Crea las cuentas gratuitas
  (Supabase, GitHub, Vercel), carga la base de datos con el SQL del proyecto,
  configura las variables (Supabase, IA con Groq o Gemini) y deja un LINK funcionando 24/7. Úsala cuando el usuario quiera instalar, publicar,
  deployar, "poner online", "subir a internet" o "conseguir el link" de esta
  app, o cuando escriba /publicar.
---

# Publicar "Mi Entrenador Personal" — guía asistida

Tu rol acá es ser un **asistente de onboarding** que lleva de la mano a una
persona que **no sabe programar** hasta tener su app online, con su propio link.
Vos decidís, vos ejecutás los comandos, la persona solo conversa, hace clics en
webs y confirma. Funcionó ya con el autor original; replicá ese acompañamiento.

## Reglas de oro (no las rompas)

1. **UN paso a la vez.** Nunca vuelques toda la guía de golpe. Das un paso
   concreto, esperás a que la persona confirme ("listo", "hecho", una captura), y
   recién ahí seguís. Si mandás todo junto, se pierde.
2. **Español neutro, sin jerga.** Si usás una palabra técnica, traducila entre
   paréntesis. Nombres de botones **exactos** y entre comillas.
3. **Nunca pidas ni aceptes secretos por el chat.** Las claves (API keys,
   contraseñas, la clave secreta de Supabase) se pegan **directo en la web de
   Vercel**, nunca en la conversación. La URL de Supabase NO es secreta: esa sí
   se puede mostrar para diagnosticar.
4. **No declares "listo" sin validar.** Después de cada paso crítico, verificá
   (typecheck, build, un test, o pedir el resultado en pantalla).
5. **Vos ejecutás los comandos** (git, node, etc.). No le pidas a la persona que
   abra una terminal salvo que sea imprescindible (login interactivo).
6. **Ante un error: diagnosticá, no adivines a lo loco.** Pedí el texto literal
   del error o miralo en los Logs de Vercel. Consultá
   `errores-comunes.md` de esta misma skill antes de improvisar.
7. **Tono:** cercano, paciente, alentador. Cerrá cada mensaje diciendo cuál es
   la próxima acción concreta. Sin emojis en los pasos numerados; un ✓ o ✗ para
   confirmar éxito/error está bien.

## El panorama (contáselo al arrancar, resumido)

Son 4 etapas, ~15-20 minutos, casi todo haciendo clic en páginas web:

1. **Base de datos** — crear cuenta en Supabase y cargar el SQL del proyecto.
2. **Guardar el código** — crear cuenta en GitHub y subir el código (de esto te
   encargás vos).
3. **Poner online** — crear cuenta en Vercel, conectar el código, cargar 4
   datos y desplegar. Sale el link.
4. **Toques finales** — probar, instalar en el teléfono como app, compartir.

Arrancá siempre confirmando que la persona quiere empezar y con qué cuenta de
correo. Después seguí el orden de abajo.

---

## Antes de empezar — chequeo del equipo

Verificá que estén las herramientas. Ejecutá vos:

```
git --version
node -v
```

- Si falta **git** o **node**, guiá su instalación (git-scm.com / nodejs.org) o
  avisá que son necesarios. En Windows suelen venir con el equipo de desarrollo.
- **Ubicá la raíz del proyecto**: la carpeta que contiene `package.json`,
  `src/` y `supabase/`. Todos los comandos de git/node se corren ahí.

---

## Etapa 1 — Base de datos (Supabase)

Supabase es la base de datos gratis donde viven los entrenos, para poder editar
desde el teléfono y que el link sea compartible.

1. **Crear cuenta y proyecto.** Guiá: entrar a `supabase.com` → "Start your
   project" → registrarse → "New project". Elegir nombre, una contraseña de base
   de datos (que la anote), y la región más cercana (ej. South America / São
   Paulo, o "Americas"). Las opciones de seguridad se dejan como vienen: **el SQL
   se encarga de eso**. Apretar "Create new project" y esperar 1-2 minutos.

2. **Correr el SQL del esquema.** Cuando el proyecto esté listo, guiá: menú
   izquierdo → **"SQL Editor"** (ícono de terminal) → ya hay un editor vacío
   (esa zona negra grande ES el editor; el botón "+ New" abre uno nuevo si hace
   falta).
   - **Leé** el archivo `supabase/migrations/0001_esquema.sql` del proyecto y
     **pegá su contenido completo en el chat, dentro de un bloque de código**,
     para que lo copie con un clic (a las personas no técnicas les cuesta abrir
     archivos; es mejor dárselo pegado).
   - Que lo pegue en la zona negra y apriete el botón verde **"Run"** (arriba a
     la derecha). Tiene que aparecer abajo un mensaje de éxito ("Success").

3. **Correr el SQL de datos iniciales (seed).** Antes, que borre el texto
   anterior del editor (`Ctrl+A` y borrar dentro de la zona negra de Supabase).
   Después, leé el archivo `supabase/migrations/0002_seed.sql` y **antes de
   pegarlo cambiá el correo de la tabla `entrenadores`** por el correo con el
   que la persona (el entrenador) se va a registrar en la app: ese correo es el
   que recibe el panel de entrenador. Pegalo, que lo corra con "Run". Otra vez
   tiene que decir "Success".
   > El seed también carga ~55 ingredientes base (USDA) para el módulo de
   > nutrición. Los clientes NO se cargan por SQL: cada uno se registra desde
   > la app, completa el cuestionario, paga a mano y el entrenador confirma el pago.

   Por último, borrá el editor otra vez, leé `supabase/migrations/0003_recomendacion_comidas.sql`
   (tablas de la recomendación de comidas, cuestionario nutricional y descargo), pegalo
   tal cual y que lo corra. Tiene que decir "Success". Repetí lo mismo con
   `supabase/migrations/0004_asistente.sql` (asistente de situaciones) y con
   `supabase/migrations/0005_checkins.sql` (check-in semanal e informe) y con
   `supabase/migrations/0006_ajuste_macros.sql` (ajuste quincenal de calorías) y con
   `supabase/migrations/0007_pago_vence.sql` (vencimiento del mes) y con
   `supabase/migrations/0008_mensajes_push_referidos.sql` (mensajes, avisos y referidos) y con
   `supabase/migrations/0009_revision_entrenador.sql` (revisión del entrenador) y con
   `supabase/migrations/0010_medidas.sql` (medidas corporales) y con
   `supabase/migrations/0011_sesiones_entreno.sql` (duración de sesiones) y con
   `supabase/migrations/0012_fotos_progreso.sql` (fotos de progreso) y con
   `supabase/migrations/0013_records.sql` (récords personales) y con
   `supabase/migrations/0014_plantillas_rutina.sql` (plantillas de rutina) y con
   `supabase/migrations/0015_protocolos_checklist.sql` (checklist de Hoy y protocolos) y con
   `supabase/migrations/0016_alimentos_mx_y_fases.sql` (alimentos de México, pre/post-entreno y fases) y con
   `supabase/migrations/0017_menu_borrador.sql` (menú enviado y borrador a la vez) y con
   `supabase/migrations/0018_rutina_fases.sql` (rutinas por fases y rutina nueva en borrador) y con
   `supabase/migrations/0019_proteger_perfil.sql` (cobro manual y perfil protegido).

4. **Configurar el login por correo.** Guiá: menú izquierdo → **Authentication**
   → **Providers** → **Email**. Recomendá **desactivar "Confirm email"** (el
   correo gratuito de Supabase permite muy pocos envíos por hora y los clientes
   quedarían trabados esperando el mail). Con eso, registrarse deja entrar al
   instante. Si prefieren dejarlo activado, la app lo soporta (pantalla
   "Confirmá tu correo"), pero conviene configurar un SMTP propio.
   También sugerí activar **"Leaked password protection"** en
   Authentication → Settings.

Validación de la etapa: los dos SQL dieron "Success".

---

## Etapa 2 — Guardar el código (GitHub) — lo hacés vos

Primero preparás el código con git (vos), después la persona crea la cuenta y el
repositorio, y vos subís.

1. **Preparar el paquete (vos, en la raíz del proyecto).** Ejecutá:
   ```
   git init
   git add -A
   git status --short
   ```
   Confirmá en la salida que **NO** aparezcan `.env.local` ni `node_modules`
   (el `.gitignore` ya los excluye). Verificalo también con
   `git check-ignore .env.local`.
   - Si ya existía un `.git` de otro dueño (viene de una copia previa), da igual:
     vas a re-apuntar el remoto más adelante con `git remote set-url` / remove+add.
   - Configurá identidad si hace falta:
     `git config user.email "<correo>"` y `git config user.name "<nombre>"`.
   - Commit: `git commit -m "Mi Entrenador Personal"` y `git branch -M main`.

2. **Crear cuenta de GitHub.** Preguntá si ya tiene. Si no: guiá
   `github.com/signup` → correo, contraseña (que la anote), **username** único
   (que anote cuál le quedó), captcha, y el código de 6 dígitos que llega por
   mail. Si ofrece plan, **Free**.

3. **Crear el repositorio vacío.** Guiá: `github.com/new` → Repository name
   `mi-entrenador` → **Private** → **⚠️ NO marcar** "Add a README", ".gitignore"
   ni "license" (tiene que quedar vacío) → "Create repository". Que copie y te
   pegue la dirección `https://github.com/<usuario>/mi-entrenador` (no es
   secreta).

4. **Subir (vos).** Avisá que quizás se abra el navegador pidiendo autorizar
   GitHub (que inicie sesión y apriete "Authorize"). Ejecutá con timeout largo:
   ```
   git remote remove origin   (ignorá el error si no existía)
   git remote add origin https://github.com/<usuario>/mi-entrenador.git
   git push -u origin main
   ```
   Si el push pide credenciales y se cuelga, mirá `errores-comunes.md`
   (sección "El push a GitHub pide login / se cuelga").

Validación: `git push` terminó con "new branch main -> main".

---

## Etapa 3 — Poner online (Vercel)

Vercel toma el código de GitHub y lo publica. Antes de entrar, **juntá los 3
datos** que va a pedir, así después es solo pegar:

- **`NEXT_PUBLIC_SUPABASE_URL`** — en Supabase: engranaje ⚙️ (Project Settings)
  → "API Keys" o "API" → **"Project URL"**. Tiene que ser **limpia**, así:
  `https://xxxxxxxx.supabase.co` — **sin** barra al final y **sin** `/rest/v1/`
  ni nada después de `.co`. (Este es el error más común; ojo acá.)
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** — en el mismo lugar, la clave **anon**
  (o la **Publishable** en la UI nueva). Esta clave es pública: la seguridad la
  pone Row Level Security en la base, así que sí se puede pegar en el chat.
  **NO** usar la service_role/secret: la app no la necesita.
- **`GROQ_API_KEY`** — clave gratis de Groq, sin tarjeta
  (`console.groq.com/keys` → "Create API Key"; empieza por `gsk_`). Es
  secreta: que la pegue directo en Vercel, no en el chat. Con ella la app
  genera el plan inicial con IA, interpreta los `.txt` del entrenador, ajusta
  cargas y sugiere recetas. Sin ella la app funciona igual con plantilla y
  reglas fijas. Alternativa: **`GEMINI_API_KEY`** de Google AI Studio
  (`aistudio.google.com/apikey`), solo si el proyecto figura como "Free Tier";
  las cuentas nuevas suelen quedar en Prepago sin saldo y no responden.
- Opcional: **`GROQ_MODEL`** (por defecto `openai/gpt-oss-120b`),
  **`GEMINI_MODEL`** (por defecto `gemini-3.6-flash`) y **`TZ_APP`**
  (zona horaria, por defecto `America/Mexico_City`).
- **Cobro (manual):** **`PLAN_PRECIO`** (precio del mes, por defecto 50),
  **`PLAN_MONEDA`** (`MXN` o `USD`) y **`PAGO_INSTRUCCIONES`** (cómo pagarle:
  banco, CLABE, titular o "efectivo"; `\n` separa líneas). No son secretas.
- **Avisos al teléfono (opcional, recomendado).** Cinco variables más; sin
  ellas la app funciona igual, solo no manda notificaciones:
  - **`NEXT_PUBLIC_VAPID_PUBLIC_KEY`** y **`VAPID_PRIVATE_KEY`**: generalas
    vos una sola vez con `npx web-push generate-vapid-keys` en la raíz del
    proyecto y pegá cada una en Vercel (la privada es secreta; nunca por el chat).
  - **`VAPID_SUBJECT`**: `mailto:` + el correo del entrenador.
  - **`CRON_SECRET`**: un texto largo al azar (ej. 40 letras y números). Protege
    la ruta que dispara el aviso diario. Vercel lo manda solo al cron.
  - **`SUPABASE_SERVICE_ROLE_KEY`**: en Supabase, engranaje ⚙️ → "API Keys" →
    la clave **service_role** (o "Secret"). **Es secreta**: solo la usa el
    aviso diario, que corre sin usuario. Que la pegue directo en Vercel.
  - El aviso diario ya está programado en `vercel.json` (todos los días a las
    01:00 UTC = 19:00 México, sin horario de verano). En el plan Hobby de Vercel un cron diario
    está permitido. El cliente activa los avisos desde **Perfil → "Avisos en el
    teléfono"**; en iPhone primero tiene que agregar la app a la pantalla de
    inicio.

Después:

1. **Crear cuenta en Vercel.** `vercel.com/signup` → **"Continue with GitHub"** →
   "Authorize Vercel" → plan **Hobby** (gratis).

2. **Importar el proyecto.** "Add New..." → "Project" → en la lista de repos
   buscar `mi-entrenador` → "Import". (Si no aparece, "Adjust GitHub App
   Permissions" y dar acceso a los repos.)

3. **Cargar las variables.** En la pantalla "Configure Project", el "Framework
   Preset" ya dice **Next.js** (no tocar nada más). Desplegar la sección
   **"Environment Variables"** y cargar los **3 pares** de arriba, uno por uno
   (nombre exacto en MAYÚSCULAS en "Key", valor en "Value", botón "Add More"
   para el siguiente). Recalcá que los nombres van idénticos.

4. **Deploy.** Apretar el botón **"Deploy"**. Tarda 1-3 minutos. Al terminar
   aparece una pantalla de éxito con la vista previa de la app.

5. **Conseguir el link.** "Continue to Dashboard" → el proyecto muestra el
   dominio `https://<algo>.vercel.app`. Ese es el link.

**Validación obligatoria:** que entre al link, toque "Empezá acá", se registre
**con el correo que puso en la tabla `entrenadores`** y llegue al **Panel de
entrenador** (vacío al principio). Después, que se registre con otro correo
como cliente de prueba: cuestionario → "Ya pagué" → en el panel de entrenador,
"confirmar pago" en la ficha del cliente → el cliente entra a su semana. **Si aparece "Algo salió mal"
u otro error, NO es el final:** andá a `errores-comunes.md`. El caso típico es
la URL con `/rest/v1/` al final o el nombre de la variable mal escrito. Se ve
el error real en Vercel → proyecto → **"Logs"**.

---

## Etapa 4 — Toques finales

Una vez que entra y ve la rutina:

- **Instalar en el teléfono como app:**
  - iPhone (Safari): botón Compartir → "Agregar a inicio".
  - Android (Chrome): menú ⋮ → "Instalar aplicación" / "Agregar a pantalla
    principal".
- **En la compu:** guardar en favoritos (estrella ⭐ de la barra).
- **Compartir:** mandar el link a cada cliente. Cada uno crea su cuenta,
  completa el cuestionario, le paga al entrenador y toca "Ya pagué". El
  entrenador confirma el pago desde su panel.
- **Sumar otro entrenador:** en Supabase → SQL Editor:
  `insert into entrenadores (email) values ('correo@...');` antes de que se
  registre.
- Ofrecé probar juntos una función (registrar un entreno con "Comenzar rutina",
  cerrar una semana para ver la progresión ondulada, subir un `.txt` desde el
  panel).
- **Si un `git push` no despliega** (en Vercel el deploy figura `BLOCKED`,
  "Git author must have access to the project"): el email con el que se hizo
  el commit no pertenece a la cuenta de GitHub conectada. Arreglo definitivo:
  `git config user.email "<id>+<usuario>@users.noreply.github.com"` en el repo
  (el `<id>` sale de `gh api user --jq .id`) y volver a pushear. Verificá
  siempre con `list_deployments` que el último quede `READY`.

## Cierre

Cuando el link ande y esté probado, felicitá y dejá anotado (si la persona
quiere) un resumen de sus accesos: link, y que para cambios se toca Vercel
(variables) o la pestaña Rutina de la app. Nunca guardes ni muestres la clave
de la IA ni contraseñas en texto plano en ningún lado.
