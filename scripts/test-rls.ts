// Verifica en vivo que Row Level Security aísla a los clientes y deja
// pasar al entrenador. Usa la clave pública (anon) + sesiones reales.
//
//   npx tsx scripts/test-rls.ts cliente@x.com pass entrenador@x.com pass
//
// Requiere NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en
// .env.local. No modifica datos (los intentos de escritura deben fallar
// o se revierten).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const linea of readFileSync(".env.local", "utf8").split("\n")) {
  const m = linea.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const [emailC, passC, emailE, passE] = process.argv.slice(2);
if (!emailC || !passC || !emailE || !passE) {
  console.error("Uso: tsx scripts/test-rls.ts <cliente> <pass> <entrenador> <pass>");
  process.exit(2);
}

let fallos = 0;
function check(nombre: string, cond: boolean, detalle?: unknown) {
  if (cond) console.log(`  OK  ${nombre}`);
  else {
    fallos++;
    console.log(`  FAIL ${nombre}`, detalle ?? "");
  }
}

async function sesion(email: string, password: string) {
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Login ${email}: ${error?.message}`);
  return { c, uid: data.user.id };
}

(async () => {
  const anon = createClient(url, key, { auth: { persistSession: false } });
  const { data: sinSesion } = await anon.from("profiles").select("id");
  check("sin sesión no se ve ningún perfil", (sinSesion ?? []).length === 0, sinSesion);
  const { data: ingAnon } = await anon.from("ingredients").select("id").limit(1);
  check("sin sesión no se ven ingredientes", (ingAnon ?? []).length === 0);

  const cli = await sesion(emailC, passC);
  const ent = await sesion(emailE, passE);

  const { data: perfilesC } = await cli.c.from("profiles").select("id, rol");
  check("cliente ve solo su perfil", perfilesC?.length === 1 && perfilesC[0].id === cli.uid, perfilesC);
  const { data: perfilesE } = await ent.c.from("profiles").select("id");
  check("entrenador ve todos los perfiles (≥ 2)", (perfilesE?.length ?? 0) >= 2, perfilesE?.length);

  const { data: mesosC } = await cli.c.from("mesocycles").select("user_id");
  check("cliente ve solo sus bloques", (mesosC ?? []).every((m) => m.user_id === cli.uid), mesosC);
  const { data: logsC } = await cli.c.from("logged_sets").select("user_id");
  check("cliente ve solo sus registros", (logsC ?? []).every((l) => l.user_id === cli.uid));

  // Escritura cruzada: el cliente intenta insertar un bloque a nombre del entrenador
  const { error: eIns } = await cli.c
    .from("mesocycles")
    .insert({ user_id: ent.uid, nombre: "intruso" });
  check("cliente NO puede insertar filas de otro usuario", !!eIns, eIns?.message);

  // El cliente intenta subirse el rol
  const { error: eRol } = await cli.c.from("profiles").update({ rol: "entrenador" }).eq("id", cli.uid);
  const { data: rolDespues } = await cli.c.from("profiles").select("rol").eq("id", cli.uid).single();
  check("cliente NO puede cambiarse el rol", !!eRol && rolDespues?.rol === "cliente", eRol?.message ?? rolDespues);

  // El cliente intenta marcarse pagado, extender su mes o reactivarse (trigger de 0019)
  const antes = (await cli.c.from("profiles").select("estado_pago, pago_vence_at, activo, nombre").eq("id", cli.uid).single()).data!;
  for (const [nombre, cambio] of [
    ["marcarse pagado", { estado_pago: "pagado" }],
    ["extender su mes", { pago_vence_at: "2099-12-31" }],
    ["darse de alta", { activo: !antes.activo }],
    ["cambiarse las macros", { macros_manual: { entreno: { kcal: 9999 } } }]
  ] as const) {
    const { error } = await cli.c.from("profiles").update(cambio).eq("id", cli.uid);
    check(`cliente NO puede ${nombre}`, !!error, error?.message ?? "se aplicó");
  }
  const despues = (await cli.c.from("profiles").select("estado_pago, pago_vence_at, activo").eq("id", cli.uid).single()).data!;
  check(
    "el pago del cliente quedó igual",
    despues.estado_pago === antes.estado_pago && despues.pago_vence_at === antes.pago_vence_at && despues.activo === antes.activo,
    despues
  );
  // Lo suyo sí lo puede editar
  const { error: eNombre } = await cli.c.from("profiles").update({ nombre: `${antes.nombre} ` }).eq("id", cli.uid);
  check("cliente sí puede editar su nombre", !eNombre, eNombre?.message);
  await cli.c.from("profiles").update({ nombre: antes.nombre }).eq("id", cli.uid);

  // Un mensaje del cliente nunca sale "de entrenador"
  const { data: msj } = await cli.c
    .from("mensajes")
    .insert({ user_id: cli.uid, de: "entrenador", texto: "prueba de RLS" })
    .select("id, de")
    .single();
  check("mensaje del cliente queda como 'cliente'", msj?.de === "cliente", msj);
  if (msj) await ent.c.from("mensajes").delete().eq("id", msj.id);

  // El cliente intenta editar el perfil del entrenador (RLS lo filtra: 0 filas)
  const { data: updOtro } = await cli.c
    .from("profiles")
    .update({ nombre: "hackeado" })
    .eq("id", ent.uid)
    .select("id");
  check("cliente NO puede editar otro perfil", (updOtro ?? []).length === 0, updOtro);

  // El cliente no puede borrar ingredientes compartidos
  const { data: delIng } = await cli.c.from("ingredients").delete().eq("fuente", "usda").select("id");
  check("cliente NO puede borrar ingredientes", (delIng ?? []).length === 0, delIng?.length);

  // El entrenador sí puede leer registros del cliente
  const { data: logsE } = await ent.c.from("logged_sets").select("id").eq("user_id", cli.uid);
  check("entrenador ve los registros del cliente", (logsE?.length ?? 0) > 0, logsE?.length);

  // El entrenador puede escribir a nombre del cliente y se revierte
  const { data: ins, error: eInsE } = await ent.c
    .from("meal_logs")
    .insert({ user_id: cli.uid, fecha: "2000-01-01", momento: "snack", ingredient_id: (await ent.c.from("ingredients").select("id").limit(1).single()).data!.id, cantidad_g: 1 })
    .select("id")
    .single();
  check("entrenador puede escribir a nombre del cliente", !eInsE && !!ins, eInsE?.message);
  if (ins) await ent.c.from("meal_logs").delete().eq("id", ins.id);

  console.log(fallos === 0 ? "\nTODOS LOS TESTS PASAN" : `\n${fallos} TEST(S) FALLARON`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
