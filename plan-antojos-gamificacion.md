# Plan: "Tus antojos" — la adherencia como juego

Fecha: 2026-09-22 · Estado: **propuesta, pendiente de autorización** · Actualización 2026-09-23: ya existe el checklist diario de Hoy (con protocolo); el motor de puntos debería basarse en su % diario ("día ≥ 70 % = X puntos") en vez de reglas sueltas.

La idea de EVER: al empezar, el cliente escribe las comidas que lo hacen
fallar (pizza, cerveza, pastel, tacos, hamburguesa…) **ordenadas por cuánto
lo tumban**. La app les pone un precio en puntos. El cliente gana puntos
cumpliendo el plan y, al llegar al precio, **se gana el pase** para darse ese
gusto.

---

## 1. Evaluación de la idea

### Por qué funciona (y por qué encaja acá)

- **Ataca el motivo real de abandono.** La gente no deja el plan por falta de
  información: lo deja porque se siente privación sin fin. Nombrar *sus*
  antojos convierte una tentación difusa en un evento planificado y con fecha.
- **Casi todo el motor ya está construido.** La app ya calcula adherencia real
  (`adherenciaSemanaActual`, `resumenDeSemana`), ya tiene check-in semanal,
  medidas, fotos, récords, duración de sesiones, informe con IA y avisos push.
  El juego no necesita datos nuevos: necesita **contarlos**.
- **El asistente de situaciones ya tiene el tipo `antojo`.** El canje puede
  reutilizarlo tal cual: "te desbloqueaste la pizza" → la IA dice cuántas
  porciones y cómo acomodar el resto del día.
- **Es el mejor gancho de renovación que puede tener la app.** Un saldo de
  puntos acumulado es un motivo concreto para pagar el mes siguiente: nadie
  quiere abandonar con 70 puntos ahorrados.

### Los tres riesgos reales (y cómo los resuelvo)

**1. "Ganarse la comida" es terreno delicado.** Premiar con comida y hacer
sentir que hay que *merecerla* puede reforzar el ciclo culpa–restricción–
atracón. La app ya reconoce esto en su descargo legal (menciona trastornos
alimentarios). No es motivo para no hacerlo, sí para cambiar el encuadre:

> **De "premio" a "antojo planificado".** La flexibilidad siempre fue parte
> del plan; los puntos no dan *permiso*, deciden **cuándo** conviene y
> **cuánto** entra. La app nunca bloquea, nunca resta puntos por comer algo,
> nunca dice "te lo ganaste" ni "no te lo mereces".

Esto además es mejor producto: el valor no es "la app me da permiso", es
"la app me dice cómo meter la pizza sin romper el plan". Eso es lo que un
PDF nunca va a hacer.

**2. Los puntos no pueden depender de la balanza.** Si el puntaje sube o baja
con el peso, una semana de retención de líquidos castiga al cliente por su
biología y se va. **Los puntos se ganan solo por lo que el cliente controla**:
entrenar, registrar, hacer el check-in, medirse. El peso y las medidas pueden
dar un bono extra, nunca una penalización.

**3. Los puntos deben ser predecibles, no "lo que diga la IA".** Acá cambio un
detalle de tu idea: si un modelo reparte puntos distintos cada semana, el
cliente no puede planear nada y el juego se siente arbitrario (además de
quemar cuota de Groq). **El puntaje es determinista**, con reglas visibles en
pantalla. La IA hace lo que hace bien: **narrar** (el informe semanal explica
qué ganaste y qué te falta) y **resolver el canje** (cómo entra la pizza el
sábado). Determinista = auditable = testeable con `npm test`.

### Mejoras que propongo sobre la idea original

| # | Mejora | Por qué |
|---|---|---|
| A | **El precio es real, no inventado.** Cuesta según *tu* ranking **×** el impacto calórico real sobre tu referencia diaria | Que la cerveza cueste menos que la pizza no es capricho: son 150 vs 1200 kcal |
| B | **El canje hace algo, no es una medalla.** Al canjear, la app elige el mejor día (de entreno, más carbos), acomoda el resto del día y dice la porción | Es la diferencia entre un badge y un servicio |
| C | **Premios que no son comida** en el mismo catálogo: día libre sin culpa, cambiar un ejercicio que odia, sesión de preguntas con EVER, saltarse el cardio | Baja el riesgo del punto 1 y da variedad |
| D | **Niveles que no se pierden** (Constante → Sólido → Imparable…) además del saldo gastable | El saldo se gasta; el nivel es identidad y no se borra al canjear |
| E | **"Te falta poco"**: la app dice exactamente qué falta ("2 entrenos y el check-in = tu pizza") | Convierte el saldo en una instrucción |
| F | **Nada de espiral de fracaso**: una mala semana no borra el saldo ni resetea nada. Si deja de pagar, el saldo queda congelado, no se pierde | Volver tiene premio |
| G | **Tope de canjes** (máx. 1 por semana, configurable) | Evita "junté 6 pizzas para el finde" |
| H | **EVER manda**: ve el saldo, da puntos de bono a mano ("comodín"), edita precios y puede apagar el módulo por cliente | El entrenador sigue en el centro; sin esto es una tragamonedas |
| I | **Opt-in y reversible**: el cliente lo activa y lo puede apagar cuando quiera | Proporcionado, sin preguntar nada médico |

---

## 2. Cómo se ve para el cliente (el recorrido)

1. **Onboarding (paso nuevo, opcional):** "¿Qué te tumba el plan?" → elige de
   una lista mexicana (tacos, pizza, cerveza, pastel, pan dulce, refresco,
   hamburguesa, alitas, helado, tortas, carnitas…) o escribe el suyo, hasta 6,
   y los **ordena** con flechas ↑↓ del que más lo tumba al que menos.
2. La app le asigna a cada uno una porción típica, sus kcal estimadas y su
   **precio en puntos**. EVER puede ajustarlo.
3. **Inicio:** una tarjeta con su saldo, su nivel y la barra hacia el próximo
   antojo: *"78 / 88 pts · te faltan 1 entreno y el check-in para tu pizza"*.
4. Cada acción suma al instante con un mensaje corto: *"Entreno registrado
   +10"*, *"Récord 🏆 +5"*.
5. Al llegar: *"Pizza desbloqueada"*. Toca **Canjear** → elige el día → la app
   (asistente IA) le dice **cuántas porciones** y **cómo queda el resto del
   día**; queda agendado y le llega el recordatorio ese día.
6. **Informe semanal:** además de los números, "ganaste 47 puntos, tu mejor
   semana" y qué falta para lo siguiente.
7. **Tu mes:** puntos del mes, nivel alcanzado, antojos disfrutados. Justo
   antes de renovar.

---

## 3. Reglas del juego (borrador, todo ajustable)

### Cómo se ganan puntos (determinista)

| Acción | Puntos | Tope |
|---|---|---|
| Entreno registrado (día planificado con series) | 10 | 1 por día planificado |
| Día con todas las comidas del menú registradas | 5 | 1 por día |
| Día con al menos una comida registrada | 2 | 1 por día (no acumula con el anterior) |
| Check-in semanal | 15 | 1 por semana |
| Medidas cargadas | 10 | 1 por semana |
| Foto de progreso | 5 | 1 por semana |
| Semana con todos los entrenos hechos | +20 bono | 1 por semana |
| Racha de semanas completas | +5 por semana seguida | máx. +20 |
| Récord personal 🏆 | 5 | máx. 3 por semana |
| Bono del entrenador | libre | manual |

Semana típica cumpliendo bien: **~90-110 puntos**.

### Cuánto cuesta un antojo

```
precio = round( (kcal_porción / kcal_referencia_diaria) × 100 × factor_ranking )
factor_ranking: 1° = 1.6 · 2° = 1.4 · 3° = 1.25 · 4° = 1.15 · resto = 1.0
mínimo 25 puntos
```

Ejemplos con una referencia de 2200 kcal/día:

| Antojo | Porción típica | kcal | Ranking | Precio |
|---|---|---|---|---|
| Pizza (3 rebanadas) | 330 g | ~880 | 1° | **64 pts** |
| Hamburguesa con papas | 400 g | ~1000 | 2° | **64 pts** |
| Cerveza (2) | 700 ml | ~300 | 3° | **25 pts** (mínimo) |
| Pastel (1 rebanada) | 120 g | ~430 | 4° | **25 pts** |
| Tacos al pastor (4) | 300 g | ~700 | 5° | **32 pts** |

Es decir: **un antojo cada 1-2 semanas** cumpliendo bien. Se calibra con EVER.
Premios que no son comida: precio fijo puesto por EVER (ej. día libre 40 pts).

---

## 4. Integración técnica

### 4.1 Base de datos — migración `0016_antojos.sql` (la 0015 la usó el checklist de Hoy)

```sql
antojos          -- catálogo del cliente
  id, user_id, nombre, orden (1 = el que más tumba), tipo ('comida'|'premio'),
  porcion text, kcal_est int, precio_puntos int, activo bool, created_at

puntos_log       -- cada movimiento, positivo o negativo
  id, user_id, fecha date, tipo text, puntos int, detalle text,
  clave text,        -- idempotencia: unique (user_id, clave)
  created_at

canjes           -- antojos desbloqueados/usados
  id, user_id, antojo_id, precio_puntos, fecha_canje, fecha_sugerida,
  estado ('agendado'|'usado'|'cancelado'), respuesta_ia jsonb, created_at

profiles.juego_activo boolean default false
```

RLS igual que el resto: `user_id = auth.uid() or public.is_entrenador()`.
El saldo es `sum(puntos_log.puntos)` (a esta escala no hace falta cachear).
`unique (user_id, clave)` evita puntos dobles por reenvío o revalidación.

### 4.2 Código nuevo

| Archivo | Qué hace |
|---|---|
| `src/lib/juego.ts` | **Puro y testeable**: `precioDe()`, `puntosDelDia()`, `puntosDeSemana()`, `nivelDe()`, `queFalta()` |
| `src/lib/juego-db.ts` | Saldo, otorgar puntos idempotente, catálogo, canjear |
| `scripts/test-juego.ts` | Tests del cálculo, sumado a `npm test` |
| `src/app/actions/antojos.ts` | Guardar catálogo, reordenar, canjear, bono del entrenador |
| `src/app/(app)/antojos/page.tsx` | Pantalla completa: saldo, catálogo, historial, canjes |
| `src/components/SaldoPuntos.tsx` | Tarjeta de Inicio (saldo + barra + qué falta) |
| `src/components/AntojosForm.tsx` | Elegir y ordenar antojos (chips + flechas ↑↓) |
| `src/components/CanjearAntojo.tsx` | Canje → elegir día → respuesta del asistente |
| `src/components/JuegoEntrenador.tsx` | Panel de EVER: saldo, historial, bono, precios, on/off |

### 4.3 Dónde se engancha (archivos que se tocan)

- `actions/entreno.ts` → `guardarSerie` / `guardarSesion` / récords: suman puntos.
- `actions/comidas.ts` → registrar comida: suma al completar el día.
- `actions/checkin.ts` → check-in: +15 y cierre de racha semanal.
- `actions/medidas.ts`, `actions/fotos.ts` → +10 / +5 semanales.
- `lib/ai-informe.ts` → el prompt recibe puntos de la semana y qué falta.
- `lib/avisos.ts` → línea en el push: "Te faltan 12 pts para tu pizza" /
  "Pizza desbloqueada: el sábado es el mejor día".
- `lib/ai-asistente.ts` → se reutiliza tal cual para el canje (tipo `antojo`).
- `lib/descargo.ts` → una línea sobre el encuadre del módulo.
- `(app)/page.tsx`, `(app)/mes/page.tsx`, ficha del entrenador → tarjetas.
- Onboarding + Perfil → paso del catálogo (editable después).

**Nada de esto rompe lo existente**: si `juego_activo = false`, todo el módulo
queda invisible y las actions salen por un `if` temprano.

### 4.4 Uso de IA (poco y barato)

1. **Una vez** al crear el catálogo: estimar porción típica y kcal de cada
   antojo (1 llamada, ~6 ítems). EVER puede corregir a mano.
2. **Al canjear**: el asistente que ya existe (1 llamada).
3. **En el informe semanal**: el prompt ya se manda, solo se le agregan datos.

Sin llamadas nuevas por día ni por registro. La cuota de Groq no se mueve.

---

## 5. Orden de ejecución

**Fase A — El motor (base + puntos visibles)**
Migración 0016, `juego.ts` + tests, catálogo en onboarding y perfil, pantalla
`/antojos`, tarjeta en Inicio, puntos otorgados desde todos los eventos que
ya existen, backfill de la semana en curso al activar.
*Al terminar: el cliente ve su saldo crecer con lo que ya hace.*

**Fase B — El canje**
Precios, desbloqueo, flujo de canje con el asistente, elección del día,
registro del antojo, tope semanal, historial.
*Al terminar: el circuito completo funciona.*

**Fase C — Integración fina**
Informe semanal con puntos, push ("te faltan X"), panel de EVER (saldo, bono,
precios, on/off), niveles, sección en "Tu mes".
*Al terminar: el juego empuja la renovación mensual.*

Cada fase termina con `tsc` + `npm test` + build + prueba end-to-end con un
usuario de prueba, y se despliega sola a Vercel con el push.

**Estimación:** A ≈ el trabajo de la ronda 2 completa; B y C algo menos cada una.

---

## 6. Decisiones que necesito de EVER

1. **¿Arranco con las tres fases seguidas** (como la vez pasada) o parás
   después de la A para verla funcionando?
2. **Precios**: ¿te sirve la fórmula de arriba (~un antojo cada 1-2 semanas) o
   lo querés más fácil / más difícil?
3. **Premios que no son comida**: ¿los sumo al catálogo? (día libre, cambiar un
   ejercicio, saltarse el cardio, sesión de preguntas con vos).
4. **Nombre del módulo**: "Tus antojos" / "Tu saldo" / "Tus puntos" / otro.
5. **Idioma**: los textos actuales están en voseo argentino ("registrá",
   "tenés"). Los textos nuevos, ¿en español neutro de México ("registra",
   "tienes")? Recomiendo sí, y convertir el resto en la misma pasada.

---

## 7. Marco legal (se mantiene el de la app)

El módulo **no prescribe ni prohíbe comida**. Encuadre explícito en pantalla:
los antojos son parte de un plan flexible, los puntos organizan *cuándo*
conviene darse el gusto, y el cliente decide siempre. Se suma una línea al
descargo ya aceptado: la app **nunca** condiciona comer a un puntaje, no
resta puntos por comer, y el módulo se puede apagar en cualquier momento.
