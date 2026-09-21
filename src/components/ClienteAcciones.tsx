"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { marcarActivo, marcarPago } from "@/app/actions/entrenador";
import type { Profile } from "@/lib/types";

export default function ClienteAcciones({
  perfil,
  tienePlan
}: {
  perfil: Profile;
  tienePlan: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function correr(fn: () => Promise<{ error?: string }>) {
    setError(null);
    iniciar(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-1.5">
        <span
          className={`chip ${
            perfil.estado_pago === "pagado" ? "border-ok/40 text-ok" : "border-warn/40 text-warn"
          }`}
        >
          {perfil.estado_pago === "pagado" ? "pagado" : "pago pendiente"}
        </span>
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            correr(() =>
              marcarPago({
                userId: perfil.id,
                estado: perfil.estado_pago === "pagado" ? "pendiente" : "pagado"
              })
            )
          }
          className="chip border-line text-muted"
        >
          {perfil.estado_pago === "pagado" ? "marcar pendiente" : "marcar pagado"}
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => correr(() => marcarActivo({ userId: perfil.id, activo: !perfil.activo }))}
          className="chip border-line text-muted"
        >
          {perfil.activo ? "dar de baja" : "reactivar"}
        </button>
      </div>
      {perfil.onboarding_completo ? (
        <Link href={`/entrenador/${perfil.id}?tab=plan`} className="btn-ghost px-3 py-1.5 text-sm">
          {tienePlan ? "Rutina nueva" : "Armar rutina"}
        </Link>
      ) : null}
      {error ? <p className="text-sm font-medium text-danger">✗ {error}</p> : null}
    </div>
  );
}
