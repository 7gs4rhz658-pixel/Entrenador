"use client";

import { useState, useTransition } from "react";
import { avisarPago } from "@/app/actions/onboarding";

// "Ya pagué": avisa al entrenador, que confirma el pago desde su panel
export default function AvisarPago({ avisado, renovacion }: { avisado: string | null; renovacion: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  function avisar() {
    setError(null);
    iniciar(async () => {
      try {
        const r = await avisarPago();
        if (r.error) setError(r.error);
        else setListo(true);
      } catch {
        setError("No hay conexión. Inténtalo de nuevo en un momento.");
      }
    });
  }

  if (listo || avisado) {
    return (
      <section className="card border-ok/40 text-center">
        <p className="font-semibold text-ok">✓ Le avisamos a tu entrenador</p>
        <p className="mt-1 text-sm text-muted">
          {avisado && !listo
            ? `Avisaste el ${new Date(avisado).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}. `
            : ""}
          En cuanto confirme tu pago {renovacion ? "se suma tu mes" : "se activa tu plan"} y te llega un aviso.
        </p>
        {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
        {avisado && !listo ? (
          <button type="button" onClick={avisar} disabled={pendiente} className="btn-ghost mt-3 w-full">
            {pendiente ? "Avisando…" : "Volver a avisar"}
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={avisar} disabled={pendiente} className="btn-primary w-full">
        {pendiente ? "Avisando…" : "Ya pagué, avisar a mi entrenador"}
      </button>
      {error ? <p className="text-sm font-medium text-danger">✗ {error}</p> : null}
    </div>
  );
}
