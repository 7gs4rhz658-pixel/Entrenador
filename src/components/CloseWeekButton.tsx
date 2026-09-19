"use client";

import { useState, useTransition } from "react";
import { finalizarSemana } from "@/app/actions/entreno";

export default function CloseWeekButton({
  mesoId,
  semana,
  esUltima
}: {
  mesoId: string;
  semana: number;
  esUltima: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    const aviso = esUltima
      ? `¿Cerrar la semana ${semana}? Es la última: el bloque queda finalizado y vas a poder crear uno nuevo partiendo de los últimos pesos.`
      : `¿Cerrar la semana ${semana}? Se calcula el plan de la semana ${semana + 1} con la progresión ondulada y la IA sugiere el peso concreto según lo que registraste.`;
    if (!window.confirm(aviso)) return;
    setError(null);
    iniciar(async () => {
      const r = await finalizarSemana(mesoId);
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="card">
      <p className="font-semibold">
        {esUltima ? "Última semana del bloque" : "¿Terminaste la semana?"}
      </p>
      <p className="mt-1 text-sm text-muted">
        {esUltima
          ? "Al cerrarla, el bloque termina y el siguiente arranca desde tus últimos pesos."
          : "Al cerrarla, la semana siguiente se planifica sola según la fase del ciclo (reps, carga o descarga) y la IA ajusta el peso con tus registros."}
      </p>
      {error ? (
        <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p>
      ) : null}
      <button
        onClick={onClick}
        disabled={pendiente}
        className="btn-primary mt-3 w-full"
      >
        {pendiente ? "Calculando la semana que viene…" : `Finalizar semana ${semana}`}
      </button>
    </div>
  );
}
