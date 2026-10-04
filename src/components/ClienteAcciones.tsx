"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { marcarActivo, marcarPago } from "@/app/actions/entrenador";
import { fmtTiempoRelativo } from "@/lib/format";
import { avisoPagoPendiente } from "@/lib/pagos";
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
  const pagado = perfil.estado_pago === "pagado";
  const avisoPago = avisoPagoPendiente(perfil);

  function correr(fn: () => Promise<{ error?: string }>) {
    setError(null);
    iniciar(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {avisoPago ? (
        <span className="chip border-ok/40 text-ok">avisó que pagó {fmtTiempoRelativo(perfil.pago_avisado_at)}</span>
      ) : null}
      <div className="flex flex-wrap justify-end gap-1.5">
        <span className={`chip ${pagado ? "border-ok/40 text-ok" : "border-warn/40 text-warn"}`}>
          {pagado ? "pagado" : "pago pendiente"}
        </span>
        {pagado ? (
          <>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => marcarPago({ userId: perfil.id, estado: "pagado" }))}
              className={`chip ${avisoPago ? "border-ok text-ok" : "border-line text-muted"}`}
            >
              renovar +30 días
            </button>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => marcarPago({ userId: perfil.id, estado: "pendiente" }))}
              className="chip border-line text-muted"
            >
              marcar pendiente
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => correr(() => marcarPago({ userId: perfil.id, estado: "pagado" }))}
            className={`chip ${avisoPago ? "border-ok text-ok" : "border-line text-muted"}`}
          >
            confirmar pago
          </button>
        )}
        <button
          type="button"
          disabled={pendiente}
          onClick={() => correr(() => marcarActivo({ userId: perfil.id, activo: !perfil.activo }))}
          className="chip border-line text-muted"
        >
          {perfil.activo ? "dar de baja" : "reactivar"}
        </button>
      </div>
      {pagado && perfil.pago_vence_at ? (
        <span className="text-xs text-muted">
          vence el {new Date(`${perfil.pago_vence_at}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
        </span>
      ) : null}
      {perfil.onboarding_completo ? (
        <Link href={`/entrenador/${perfil.id}?tab=plan`} className="btn-ghost px-3 py-1.5 text-sm">
          {tienePlan ? "Rutina nueva" : "Armar rutina"}
        </Link>
      ) : null}
      {error ? <p className="text-sm font-medium text-danger">✗ {error}</p> : null}
    </div>
  );
}
