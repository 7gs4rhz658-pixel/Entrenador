"use client";

import { useState } from "react";

// "Trae a un amigo": el cliente comparte su código; quien se registra con
// él queda enlazado y el entrenador aplica el beneficio a los dos.
export default function CodigoReferido({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Entreno con esta app y me va bien. Registrate con mi código ${codigo} y los dos tenemos descuento el mes que viene: ${typeof window !== "undefined" ? window.location.origin : ""}/registro?ref=${codigo}`;

  async function compartir() {
    try {
      if (navigator.share) return void (await navigator.share({ text: texto }));
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {}
  }

  return (
    <section className="card mt-4 text-sm">
      <p className="font-semibold">Trae a un amigo</p>
      <p className="mt-1 text-muted">
        Si alguien se registra con tu código, los dos tienen descuento el mes siguiente (lo aplica tu
        entrenador).
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="chip border-accent/60 px-3 py-1 text-base font-bold tracking-wider text-accent">{codigo}</span>
        <button type="button" onClick={compartir} className="btn-ghost flex-1 py-1.5 text-sm">
          {copiado ? "✓ Copiado" : "Compartir"}
        </button>
      </div>
    </section>
  );
}
