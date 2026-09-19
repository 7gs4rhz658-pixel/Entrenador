"use client";

import { useEffect, useState } from "react";
import type { ItemCompra } from "@/lib/meal-plan";

// Lista de compras con tildes que se recuerdan en este teléfono y botón
// para compartirla (WhatsApp o lo que tenga el sistema).
export default function ListaCompras({
  planId,
  lista,
  texto
}: {
  planId: string;
  lista: ItemCompra[];
  texto: string;
}) {
  const clave = `compras:${planId}`;
  const [tildados, setTildados] = useState<Set<string>>(new Set());
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(clave);
      if (raw) setTildados(new Set(JSON.parse(raw) as string[]));
    } catch {}
  }, [clave]);

  function toggle(nombre: string) {
    setTildados((s) => {
      const n = new Set(s);
      if (n.has(nombre)) n.delete(nombre);
      else n.add(nombre);
      try {
        localStorage.setItem(clave, JSON.stringify([...n]));
      } catch {}
      return n;
    });
  }

  async function compartir() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Compras de la semana", text: texto });
        return;
      }
    } catch {
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {}
  }

  return (
    <section className="card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">Compras de la semana</h2>
        <span className="text-xs text-muted">
          {tildados.size}/{lista.length}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {lista.map((i) => {
          const on = tildados.has(i.nombre);
          return (
            <li key={i.nombre}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${
                  on ? "border-line opacity-50" : "border-line"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(i.nombre)}
                  className="h-5 w-5 accent-[var(--accent)]"
                />
                <span className={`flex-1 ${on ? "line-through" : ""}`}>{i.nombre}</span>
                <span className="shrink-0 text-sm font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {i.practico}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={compartir} className="btn-primary flex-1">
          Compartir
        </button>
        <button type="button" onClick={copiar} className="btn-ghost flex-1">
          {copiado ? "✓ Copiado" : "Copiar"}
        </button>
      </div>
    </section>
  );
}
