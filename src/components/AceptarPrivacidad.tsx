"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { aceptarPrivacidad } from "@/app/actions/auth";

// Para quien creó su cuenta antes del aviso de privacidad: lo acepta una vez
export default function AceptarPrivacidad() {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="card mb-4 border-accent/50 text-sm">
      <p className="font-semibold">🔒 Aviso de privacidad</p>
      <p className="mt-1 text-muted">
        Tu entrenador guarda en la app datos de salud (peso, medidas, fotos, lesiones) para armar tu plan. Léelo y
        acéptalo para seguir.{" "}
        <Link href="/privacidad" className="font-semibold text-accent">
          Leer aviso →
        </Link>
      </p>
      {error ? <p className="mt-2 font-medium text-danger">✗ {error}</p> : null}
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            setError(null);
            try {
              const r = await aceptarPrivacidad();
              if (r.error) setError(r.error);
            } catch {
              setError("No hay conexión. Inténtalo de nuevo.");
            }
          })
        }
        className="btn-primary mt-3 w-full"
      >
        {pendiente ? "Guardando…" : "Acepto"}
      </button>
    </section>
  );
}
