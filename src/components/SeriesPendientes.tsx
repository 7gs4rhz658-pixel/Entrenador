"use client";

import { useSeriesPendientes } from "@/lib/cola-series";

// Aviso de series anotadas sin señal; mientras esté montado las sube solo
export default function SeriesPendientes() {
  const n = useSeriesPendientes();
  if (!n) return null;
  return (
    <p className="mb-3 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
      ⏳ {n === 1 ? "1 serie quedó" : `${n} series quedaron`} guardada{n === 1 ? "" : "s"} en tu teléfono por falta de señal.
      Se suben solas cuando vuelva la conexión; no cierres sesión.
    </p>
  );
}
