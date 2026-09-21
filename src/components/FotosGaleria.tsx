"use client";

import { useState, useTransition } from "react";
import { borrarFoto } from "@/app/actions/fotos";
import { fmtFechaCorta } from "@/lib/format";
import type { FotoProgreso, VistaFoto } from "@/lib/types";

const VISTAS: { id: VistaFoto; texto: string }[] = [
  { id: "frente", texto: "Frente" },
  { id: "perfil", texto: "Perfil" },
  { id: "espalda", texto: "Espalda" }
];

export interface FotoConUrl extends FotoProgreso {
  url: string | null;
}

// Comparación lado a lado (antes / después) por vista y galería por fecha.
// `fotos` viene de la más nueva a la más vieja, con URL firmada.
export default function FotosGaleria({ fotos, puedeBorrar = true }: { fotos: FotoConUrl[]; puedeBorrar?: boolean }) {
  const fechas = [...new Set(fotos.map((f) => f.fecha))]; // nuevas → viejas
  const [antes, setAntes] = useState(fechas[fechas.length - 1] ?? "");
  const [despues, setDespues] = useState(fechas[0] ?? "");
  const [vista, setVista] = useState<VistaFoto>("frente");
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!fotos.length) {
    return (
      <p className="card text-center text-sm text-muted">
        Todavía no hay fotos. La primera es tu punto de partida: en un mes la comparación habla sola.
      </p>
    );
  }

  const de = (fecha: string, v: VistaFoto) => fotos.find((f) => f.fecha === fecha && f.vista === v) ?? null;
  const fa = de(antes, vista);
  const fd = de(despues, vista);

  function borrar(f: FotoConUrl) {
    if (!window.confirm(`¿Borrar la foto de ${f.vista} del ${fmtFechaCorta(f.fecha)}?`)) return;
    setError(null);
    iniciar(async () => {
      const r = await borrarFoto({ id: f.id, path: f.path });
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {fechas.length >= 2 ? (
        <section className="card">
          <h2 className="font-bold">Antes y después</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {VISTAS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVista(v.id)}
                className={`chip ${vista === v.id ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"}`}
              >
                {v.texto}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { titulo: "Antes", fecha: antes, set: setAntes, foto: fa },
              { titulo: "Después", fecha: despues, set: setDespues, foto: fd }
            ].map((col) => (
              <div key={col.titulo}>
                <select value={col.fecha} onChange={(e) => col.set(e.target.value)} className="input mb-1.5 px-2 py-1 text-sm">
                  {fechas.map((f) => (
                    <option key={f} value={f}>
                      {col.titulo}: {fmtFechaCorta(f)}
                    </option>
                  ))}
                </select>
                <div className="aspect-[3/4] overflow-hidden rounded-xl border border-line bg-surface2">
                  {col.foto?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={col.foto.url} alt={`${col.titulo} · ${vista} · ${col.fecha}`} className="h-full w-full object-cover" />
                  ) : (
                    <p className="flex h-full items-center justify-center p-2 text-center text-xs text-muted">Sin foto de {vista} en esa fecha</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 className="font-bold">Todas las fotos</h2>
        <div className="mt-2 flex flex-col gap-3">
          {fechas.map((fecha) => (
            <div key={fecha}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{fmtFechaCorta(fecha)}</p>
              <div className="grid grid-cols-3 gap-2">
                {VISTAS.map((v) => {
                  const f = de(fecha, v.id);
                  return (
                    <div key={v.id} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-surface2">
                      {f?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.url} alt={`${v.texto} · ${fecha}`} className="h-full w-full object-cover" />
                      ) : (
                        <p className="flex h-full items-center justify-center text-xs text-muted">{v.texto}</p>
                      )}
                      {f && puedeBorrar ? (
                        <button
                          type="button"
                          onClick={() => borrar(f)}
                          disabled={pendiente}
                          className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white"
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
      </section>
    </div>
  );
}
