import { redirect } from "next/navigation";
import PantallaPago from "@/components/PantallaPago";
import { requireSesion } from "@/lib/auth";
import { hoyFecha } from "@/lib/format";
import { avisoPagoPendiente, estadoPago } from "@/lib/pagos";

// Margen por si el aviso al entrenador (push) tarda.
export const maxDuration = 60;

export default async function PagoPage() {
  const { perfil } = await requireSesion();
  if (perfil.rol === "entrenador") redirect("/entrenador");
  if (!perfil.onboarding_completo) redirect("/cuestionario");
  const estado = estadoPago(perfil, hoyFecha());
  // Con el mes vigente solo se puede renovar cuando faltan 7 días o menos
  if (estado.pagado && !estado.vencido && (estado.diasRestantes ?? 99) > 7) redirect("/");

  return <PantallaPago estado={estado} avisado={avisoPagoPendiente(perfil) ? perfil.pago_avisado_at : null} />;
}
