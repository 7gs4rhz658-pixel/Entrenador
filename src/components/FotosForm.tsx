"use client";

import { useRef, useState } from "react";
import { subirFotos } from "@/app/actions/fotos";
import type { VistaFoto } from "@/lib/types";

const VISTAS: { id: VistaFoto; texto: string; guia: string }[] = [
  { id: "frente", texto: "Frente", guia: "De pie, relajado, brazos a los costados." },
  { id: "perfil", texto: "Perfil", guia: "Lado izquierdo, postura natural, sin meter panza." },
  { id: "espalda", texto: "Espalda", guia: "De espaldas, brazos a los costados." }
];

// Reduce la foto en el teléfono antes de subirla (lado máximo 1280 px,
// JPEG 82 %): de varios MB a ~200-400 KB.
async function comprimir(archivo: File): Promise<File> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.82));
  return new File([blob], archivo.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

// Subida de fotos de progreso (frente, perfil, espalda) de una fecha.
// Misma luz, misma distancia, misma hora: así la comparación vale.
export default function FotosForm({ hoy, userId }: { hoy: string; userId?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setOcupado(true);
    try {
      const datos = new FormData(e.currentTarget);
      const salida = new FormData();
      salida.set("fecha", String(datos.get("fecha") ?? hoy));
      if (userId) salida.set("userId", userId);
      let alguna = false;
      for (const v of VISTAS) {
        const f = datos.get(v.id);
        if (f instanceof File && f.size > 0) {
          salida.set(v.id, await comprimir(f));
          alguna = true;
        }
      }
      if (!alguna) throw new Error("Elegí al menos una foto.");
      const r = await subirFotos(salida);
      if (r.error) throw new Error(r.error);
      setOk(`${r.subidas} foto${r.subidas === 1 ? "" : "s"} guardada${r.subidas === 1 ? "" : "s"}.`);
      form.current?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron subir.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="card">
      <button type="button" onClick={() => setAbierto((a) => !a)} className="flex w-full items-center justify-between text-left">
        <div>
          <h2 className="font-bold">Fotos de progreso</h2>
          <p className="text-xs text-muted">
            Una vez por mes, misma luz y misma distancia. Solo las ven vos y tu entrenador.
          </p>
        </div>
        <span className="text-muted">{abierto ? "▾" : "▸"}</span>
      </button>
      {abierto ? (
        <form ref={form} onSubmit={enviar} className="mt-3 flex flex-col gap-3">
          <div>
            <label htmlFor="fecha_fotos" className="label">
              Fecha
            </label>
            <input id="fecha_fotos" name="fecha" type="date" defaultValue={hoy} max={hoy} className="input w-48" />
          </div>
          {VISTAS.map((v) => (
            <div key={v.id}>
              <label htmlFor={`foto_${v.id}`} className="label">
                {v.texto} <span className="font-normal">· {v.guia}</span>
              </label>
              <input
                id={`foto_${v.id}`}
                name={v.id}
                type="file"
                accept="image/*"
                capture="environment"
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface2 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink"
              />
            </div>
          ))}
          {error ? <p className="text-sm font-medium text-danger">✗ {error}</p> : null}
          {ok ? <p className="text-sm font-medium text-ok">✓ {ok}</p> : null}
          <button type="submit" className="btn-primary w-full" disabled={ocupado}>
            {ocupado ? "Subiendo…" : "Guardar fotos"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
