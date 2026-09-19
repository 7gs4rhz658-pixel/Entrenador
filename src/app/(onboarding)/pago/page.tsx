import { redirect } from "next/navigation";
import PagoForm from "@/components/PagoForm";
import { requireSesion } from "@/lib/auth";
import { PAGO_SIMULADO, PLAN } from "@/lib/pagos";

// La acción de pago llama a la IA para generar el plan: le damos margen.
export const maxDuration = 60;

export default async function PagoPage() {
  const { perfil } = await requireSesion();
  if (perfil.rol === "entrenador") redirect("/entrenador");
  if (!perfil.onboarding_completo) redirect("/cuestionario");
  if (perfil.estado_pago === "pagado") redirect("/");

  return (
    <main>
      <header className="mb-5 text-center">
        <div className="mb-2 text-4xl">💳</div>
        <h1 className="text-2xl font-bold">Último paso</h1>
        <p className="mt-1 text-muted">
          Activá tu plan y en unos segundos tenés tu rutina lista.
        </p>
      </header>

      <section className="card mb-4">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">{PLAN.nombre}</p>
          <p className="text-xl font-bold">
            {PLAN.moneda} {PLAN.precio.toLocaleString("es-AR")}
          </p>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
          {PLAN.incluye.map((t) => (
            <li key={t}>✓ {t}</li>
          ))}
        </ul>
      </section>

      {PAGO_SIMULADO ? (
        <p className="mb-4 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
          <strong>Pago simulado:</strong> no se cobra nada. Usá cualquier
          número de tarjeta (ej. 4111 1111 1111 1111). Una que termine en
          0002 simula un rechazo.
        </p>
      ) : null}

      <PagoForm />
    </main>
  );
}
