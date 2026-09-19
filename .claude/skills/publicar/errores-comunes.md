# Errores comunes al publicar (y cómo resolverlos)

Post-mortem de problemas reales. Antes de improvisar, buscá el patrón acá.
Regla general: **pedí el texto literal del error** o miralo en
**Vercel → proyecto → "Logs"** (recargá la app para generar el error fresco y
expandí la línea roja; el texto después de `Error:` dice la causa).

---

## "Algo salió mal" al entrar a la app (Server Components render)

La app carga (el login funcionó, se ve el menú de abajo), pero la pantalla
muestra "Algo salió mal". Es un fallo al hablar con la base de datos. En los
Logs de Vercel vas a ver el motivo real. Casos:

### a) `Base de datos: Invalid path specified in request URL`
**Causa:** la variable `NEXT_PUBLIC_SUPABASE_URL` está mal formada — casi siempre tiene
`/rest/v1/` o una barra `/` al final.
**Ejemplo real:** `https://wjtewstimotcrbjsmrvt.supabase.co/rest/v1/` ← mal.
**Solución:** en Vercel → proyecto → Settings → Environment Variables → editar
`NEXT_PUBLIC_SUPABASE_URL` y dejarla **limpia**: `https://xxxxxxxx.supabase.co` (sin barra
final, sin `/rest/v1/`, sin espacios). Guardar y **Redeploy** (ver más abajo).
> Como la URL no es secreta, pedile que te la muestre para confirmar el arreglo.

### b) `Base de datos: Invalid API key` (o errores de JWT)
**Causa:** la clave `NEXT_PUBLIC_SUPABASE_ANON_KEY` está mal (pegada incompleta, con
espacios, o vencida).
**Solución:** volver a copiar la clave **anon / Publishable** desde Supabase
(engranaje → API Keys) y re-pegarla en Vercel. Guardar y Redeploy.

### c) `No existe el perfil de este usuario. Ejecutá las migraciones...`
**Causa 1:** faltó correr el SQL (o solo se corrió uno de los dos archivos)
antes de que la persona se registrara, así que el trigger que crea el perfil
no existía.
**Solución:** correr `0001_esquema.sql` y después `0002_seed.sql` en el SQL
Editor de Supabase, y después crear el perfil faltante a mano:
`insert into profiles (id, email, nombre, rol) select id, email, '', 'cliente' from auth.users where id not in (select id from profiles);`

### c2) La persona se registró pero NO le aparece el panel de entrenador
**Causa:** su correo no estaba en la tabla `entrenadores` al registrarse (el
rol se decide en ese momento).
**Solución:** en el SQL Editor:
`update profiles set rol = 'entrenador' where email = 'correo@...';` y que
recargue la app.

### c3) Al registrarse dice "Revisá tu correo" y el mail nunca llega
**Causa:** "Confirm email" activado en Supabase con el SMTP gratuito (muy
limitado).
**Solución:** Authentication → Providers → Email → desactivar "Confirm email".
Para confirmar a los que ya quedaron colgados:
`update auth.users set email_confirmed_at = now() where email_confirmed_at is null;`

### d) `Faltan las variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY`
**Causa:** no se cargaron (o se cargaron con el nombre mal escrito, ej.
minúsculas o un espacio).
**Solución:** revisar en Vercel que existan las variables con los nombres
EXACTOS: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
`GEMINI_API_KEY`. Corregir y Redeploy.

---

## Cómo hacer un "Redeploy" (aplicar un cambio de variables)

Cambiar una variable **no se aplica solo**. Guiá:
Vercel → proyecto → pestaña **"Deployments"** → en la fila de más arriba, los
tres puntitos **⋯** → **"Redeploy"** → confirmar "Redeploy". Espera 1-2 min a
que quede "Ready" (puntito verde). Después recargar la app con F5.

---

## El push a GitHub pide login / se cuelga

Al hacer `git push`, en Windows suele abrirse el navegador (Git Credential
Manager) para iniciar sesión en GitHub. Avisá de antemano que puede pasar y que
inicie sesión y apriete "Authorize".
- Si se queda colgado: cancelá, verificá que la persona esté logueada en GitHub
  en su navegador, y reintentá el push.
- Alternativa: usar GitHub Desktop (desktop.github.com), o crear un Personal
  Access Token y usarlo como contraseña al pushear. Evitá que el token quede
  escrito en el chat.

---

## El repositorio ya existía / tiene código de otro dueño

Si la carpeta viene de una copia previa con su propio `.git` apuntando a otro
repositorio:
```
git remote set-url origin https://github.com/<usuario-nuevo>/mi-entrenador.git
```
(o `git remote remove origin` y después `git remote add origin ...`).
Después `git push -u origin main`. El historial previo no molesta.

---

## En "Configure Project" no aparece "Environment Variables"

Está **plegado**. Es una fila con una flechita `›` justo arriba del botón
"Deploy". Hacer clic para desplegarla y aparecen los casilleros "Key" / "Value".

---

## El repo `mi-entrenador` no aparece en Vercel al importar

Vercel no tiene permiso para verlo. En la pantalla de import, buscar el enlace
"Adjust GitHub App Permissions" (o "Configure GitHub") → autorizar acceso a los
repositorios (se puede elegir "All repositories") → volver.

---

## Se metió en "Team Settings" en vez de las variables del proyecto

Las variables de entorno están en la config del **proyecto**, no del equipo.
Si el menú izquierdo muestra "Billing", "Members", "Team URL", está un nivel de
más. Guiá: arriba "All Projects" → entrar al proyecto `mi-entrenador` → pestaña
"Settings" del proyecto → "Environment Variables" (ese menú tiene "Domains",
"Git", "Functions"...).

---

## El build de Vercel falla ("Build Failed")

Abrir el log del build en Vercel y leer el error. Suele ser código, no
configuración. Chequeos rápidos que podés correr vos en la raíz del proyecto:
```
npm install
npm run typecheck
npm run build
```
Si `build` pasa en local pero falla en Vercel, revisá que el "Root Directory" en
Vercel apunte a la carpeta con el `package.json` (normalmente `./`).

---

## Nota sobre versiones nuevas de Supabase

La interfaz de Supabase cambia seguido. Los datos que importan son siempre dos:
1. **Project URL** — la base `https://xxxx.supabase.co` (limpia).
2. La **clave pública**: la histórica **anon** o, en la UI nueva de "API Keys",
   la **Publishable key**. La app NO usa la service_role/secret: cada usuario
   entra con su sesión y Row Level Security decide qué ve.
