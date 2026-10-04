// Tope diario de IA por cliente. El asistente, las recetas y sustituir
// usan el plan gratis de Groq (1 000 pedidos al día y 8 000 tokens por
// minuto), el mismo que usa el entrenador para leer planes: un cliente no
// puede gastarlo solo. El entrenador no tiene tope.

import { requireSesion } from "./auth";
import { exec } from "./data";
import { hoyFecha } from "./format";
import { estadoPago } from "./pagos";
import { db } from "./supabase/server";

export const TOPE_IA_DIA = 15;

// Null si puede usar la IA (y cuenta la consulta); si no, el motivo.
export async function permitirIA(tipo: "asistente" | "recetas" | "sustituir"): Promise<string | null> {
  const { userId, perfil } = await requireSesion();
  if (perfil.rol === "entrenador") return null;
  const hoy = hoyFecha();
  const pago = estadoPago(perfil, hoy);
  if (!perfil.activo || !pago.pagado || pago.vencido) {
    return "Las sugerencias con IA están disponibles con tu plan activo.";
  }
  const { count, error } = await db()
    .from("ia_uso")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("fecha", hoy);
  if (error) throw new Error(`Base de datos: ${error.message}`);
  if ((count ?? 0) >= TOPE_IA_DIA) {
    return `Llegaste a las ${TOPE_IA_DIA} consultas con IA de hoy. Mañana se renuevan; mientras, escríbele a tu entrenador.`;
  }
  await exec(db().from("ia_uso").insert({ user_id: userId, fecha: hoy, tipo }));
  return null;
}
