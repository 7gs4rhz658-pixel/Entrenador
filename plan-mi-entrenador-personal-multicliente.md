# Plan: Mi Entrenador Personal → App multi-cliente con nutrición e IA

## Punto de partida
Proyecto base subido en zip (`mi-entrenador-personal`): app Next.js + Supabase de un solo usuario, con contraseña compartida (`SITE_PASSWORD`), sin cuentas individuales.

**Estado verificado:** dependencias instaladas, `tsc --noEmit` y `next build` corren limpios sobre el código original (11 rutas, sin errores). Aún no se escribió código nuevo — el siguiente paso pendiente es conectar un proyecto real de Supabase para poder crear y probar las migraciones en vivo.

## Objetivo final
App publicada y funcionando (link real, accesible desde el celular), usando el mismo método de despliegue que ya trae el proyecto: **Supabase (base de datos) → GitHub (código) → Vercel (hosting)**.

---

## 1. Base multi-cliente
- Reemplazar `SITE_PASSWORD` por **Supabase Auth** (login individual por correo).
- Agregar `cliente_id` + **Row Level Security** a todas las tablas existentes (`Profile`, `Mesocycle`, `Exercise`, `PlannedSet`, `LoggedSet`) para que cada cliente vea solo lo suyo.
- **Panel de entrenador** (rol propio de EVER): ver todos los clientes, sus rutinas y su progreso.

## 2. Alta de cliente y gestión del plan
- **Cuestionario + pago** (checkout mock primero, con ruta a pago real después) → la IA genera el mesociclo inicial (ejercicios, series, reps, pesos de partida).
- **EVER puede editar** el plan generado desde el panel de entrenador.
- **Reemplazo total por `.txt`**: EVER sube un archivo con el plan que el cliente debe seguir; el sistema lo interpreta con IA y sustituye completamente el mesociclo generado.

## 3. Entrenamiento
- **Cronómetro de descanso configurable** por ejercicio y por serie.
- **Botón "Comenzar rutina"**: guía ejercicio por ejercicio, dispara el cronómetro automáticamente al registrar cada serie.
- **Peso de la semana anterior visible** al momento de registrar series, para decidir si repetir o subir carga.
- **Nuevo motor de progresión ondulada de 4 semanas** (reemplaza el actual, que es reactivo):
  - Semana 1: rango bajo de reps (ej. 10–15, arranca en 10) al peso base.
  - Semana 2: mismo peso, llega al tope del rango (15 reps).
  - Semana 3: sube el peso, vuelve a 10 reps.
  - Semana 4: descarga — 50% del peso.
  - Semana 5: reinicia con el peso de la semana 3 (no el original), repite el ciclo.
  - La **IA sugiere el ajuste de peso concreto** cada semana, tomando como base los registros reales guardados (reps/peso/RIR), no un cálculo ciego.

## 4. Nutrición de seguimiento real (módulo nuevo, hoy no existe)
- Hoy la app solo calcula kcal/agua de referencia (Mifflin-St Jeor), sin macros ni registro de comidas.
- **Objetivos con macros reales** (proteína/carbohidratos/grasa) según objetivo del cliente (déficit, mantenimiento, superávit) — hoy el superávit está fijo en el código.
- **Base de ingredientes** con macros por 100g, alimentada desde una fuente de datos nutricional abierta y gratuita (ej. Open Food Facts) — los números deben salir de datos reales, no de la IA.
- **Registro de comidas** del cliente (ingrediente + cantidad), sumado contra el objetivo diario.
- **Sustitución de ingredientes con ajuste de cantidad**: ej. cambiar "frutos rojos" por "manzana" y que el sistema calcule la cantidad de manzana que mantiene los mismos macros del plato. El cálculo es matemático (regla de tres sobre la tabla de ingredientes); la IA interpreta el pedido en lenguaje natural y sugiere reemplazos con sentido.
- **Recetas y sugerencias** generadas por IA dentro de los macros restantes del día.

## 5. Capa de IA
- Proxy en el servidor (la clave nunca se expone en el navegador) usando **Gemini gratis**, igual que en otros proyectos de EVER.
- Usos: generar plan inicial desde el cuestionario, interpretar el `.txt` subido por EVER, sugerir ajustes de carga semana a semana, interpretar sustituciones de ingredientes y generar recetas.

## 6. Publicación (guiada paso a paso)
1. **Supabase**: cuenta + proyecto nuevo → `Project URL` y `service_role key` desde Project Settings → API. *(Paso actual — pendiente de que EVER lo conecte.)*
2. **Gemini**: clave de API gratis.
3. **GitHub**: cuenta para subir el código.
4. **Vercel**: conectado a GitHub, variables de entorno cargadas, deploy → link final probado y funcionando.

---

## Resumen de la tabla de módulos

| Módulo | Incluye |
|---|---|
| Multi-cliente | Supabase Auth, `cliente_id` + RLS, panel de entrenador |
| Alta de cliente | Cuestionario + pago (mock, con ruta a pago real) → plan inicial por IA |
| Gestión de plan | EVER edita el plan generado, o lo reemplaza 100% subiendo un `.txt` |
| Entrenamiento | Cronómetro configurable, "Comenzar rutina", peso semana anterior visible, progresión ondulada de 4 semanas con sugerencia de carga por IA |
| Nutrición | Macros por objetivo, base de ingredientes, registro de comidas, sustitución con ajuste de cantidad, recetas por IA |
| IA | Proxy en servidor con Gemini gratis |
| Publicación | Supabase → GitHub → Vercel |
