import { NextResponse, type NextRequest } from "next/server";
import { armarAvisoDiario } from "@/lib/avisos";
import { getSesion } from "@/lib/auth";
import { getPerfil, getSuscripcionesPush } from "@/lib/data";
import { pushDisponible } from "@/lib/push";

// Vista previa del aviso diario de un cliente (solo entrenador): sirve
// para ver qué le llegaría esta noche sin esperar al cron.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sesion = await getSesion();
  if (!sesion || sesion.perfil.rol !== "entrenador") {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const userId = req.nextUrl.searchParams.get("user");
  if (!userId) return NextResponse.json({ error: "falta ?user=" }, { status: 400 });
  const perfil = await getPerfil(userId);
  const [aviso, subs] = await Promise.all([armarAvisoDiario(perfil), getSuscripcionesPush(userId)]);
  return NextResponse.json({ push_configurado: pushDisponible(), dispositivos: subs.length, aviso });
}
