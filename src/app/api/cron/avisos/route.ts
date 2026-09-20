import { NextResponse, type NextRequest } from "next/server";
import { armarAvisoDiario } from "@/lib/avisos";
import { getClientes } from "@/lib/data";
import { enviarPush, pushDisponible } from "@/lib/push";
import { adminDisponible, conAdmin } from "@/lib/supabase/server";

// Aviso diario (Vercel Cron, ~19:00 hora de la app): a cada cliente con
// avisos activos le llega UNA notificación con lo más importante de
// mañana. Corre sin usuario, con la clave service_role, protegido con
// CRON_SECRET.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  if (!pushDisponible()) return NextResponse.json({ ok: true, enviados: 0, motivo: "push no configurado" });
  if (!adminDisponible()) return NextResponse.json({ ok: true, enviados: 0, motivo: "falta SUPABASE_SERVICE_ROLE_KEY" });

  const resultado = await conAdmin(async () => {
    const clientes = (await getClientes()).filter((c) => c.activo && c.onboarding_completo && c.estado_pago === "pagado");
    let enviados = 0;
    const detalle: { email: string; aviso: string }[] = [];
    for (const c of clientes) {
      const carga = await armarAvisoDiario(c);
      const n = await enviarPush(c.id, carga);
      if (n) {
        enviados += n;
        detalle.push({ email: c.email, aviso: carga.cuerpo });
      }
    }
    return { enviados, detalle };
  });

  return NextResponse.json({ ok: true, ...resultado });
}
