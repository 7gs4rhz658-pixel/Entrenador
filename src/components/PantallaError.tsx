"use client";

import Link from "next/link";
import { useEffect } from "react";

// Pantalla de error común: mensaje amable, código para reportarlo y
// reintentar. En producción Next oculta el detalle de los errores del
// servidor; el código (digest) permite encontrarlo en los logs de Vercel.
export default function PantallaError({
  error,
  reset,
  inicio = "/"
}: {
  error: Error & { digest?: string };
  reset: () => void;
  inicio?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const sinRed = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <main className="card mx-auto mt-10 max-w-md text-center">
      <p className="text-lg font-semibold">{sinRed ? "📶 Sin conexión" : "✗ Algo salió mal"}</p>
      <p className="mt-2 text-sm text-muted">
        {sinRed
          ? "Revisa tu señal y vuelve a intentarlo. Lo que ya guardaste no se pierde."
          : "No es tu culpa. Vuelve a intentarlo; si se repite, avísale a tu entrenador."}
      </p>
      {error.digest ? <p className="mt-2 text-xs text-muted">Código: {error.digest}</p> : null}
      <div className="mt-4 flex gap-2">
        <Link href={inicio} className="btn-ghost flex-1">
          Ir al inicio
        </Link>
        <button onClick={reset} className="btn-primary flex-1">
          Reintentar
        </button>
      </div>
    </main>
  );
}
