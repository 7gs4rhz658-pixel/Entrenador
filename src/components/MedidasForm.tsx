"use client";

import { useState } from "react";
import { guardarMedidas } from "@/app/actions/medidas";
import { ETIQUETAS_MEDIDA, GRUPOS_MEDIDA, GUIA_MEDIDA } from "@/lib/medidas";
import type { CampoMedida, Medida } from "@/lib/types";
import { useFormulario } from "@/lib/use-formulario";

function BotonGuardar({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Guardando…" : "Guardar medidas"}
    </button>
  );
}

// Toma de medidas con guía de cómo medir. Los campos vacíos no se
// guardan; la última toma se precarga como referencia (placeholder).
export default function MedidasForm({
  hoy,
  ultima,
  pesoActual,
  userId
}: {
  hoy: string;
  ultima: Medida | null;
  pesoActual: number | null;
  userId?: string; // solo lo pasa el entrenador
}) {
  const [estado, enviar, pendiente] = useFormulario(guardarMedidas, {});
  const [abierto, setAbierto] = useState(!ultima);
  const [guia, setGuia] = useState<CampoMedida | null>(null);

  return (
    <section className="card">
      <button type="button" onClick={() => setAbierto((a) => !a)} className="flex w-full items-center justify-between text-left">
        <div>
          <h2 className="font-bold">{ultima ? "Nueva toma de medidas" : "Cargá tus medidas"}</h2>
          <p className="text-xs text-muted">
            Misma hora, mismo lado, cinta sin apretar. Con una toma por semana alcanza.
          </p>
        </div>
        <span className="text-muted">{abierto ? "▾" : "▸"}</span>
      </button>

      {abierto ? (
        <form onSubmit={enviar} className="mt-3 flex flex-col gap-4">
          {userId ? <input type="hidden" name="userId" value={userId} /> : null}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fecha" className="label">
                Fecha
              </label>
              <input id="fecha" name="fecha" type="date" defaultValue={hoy} max={hoy} className="input" />
            </div>
            <div>
              <label htmlFor="peso_kg" className="label">
                Peso (kg)
              </label>
              <input
                id="peso_kg"
                name="peso_kg"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={30}
                max={300}
                placeholder={pesoActual != null ? String(pesoActual) : "—"}
                className="input"
              />
            </div>
          </div>

          {GRUPOS_MEDIDA.map((g) => (
            <div key={g.titulo}>
              <p className="label">{g.titulo} (cm)</p>
              <div className="grid grid-cols-2 gap-2">
                {g.campos.map((campo) => (
                  <div key={campo}>
                    <div className="flex items-center justify-between">
                      <label htmlFor={campo} className="text-xs text-muted">
                        {ETIQUETAS_MEDIDA[campo]}
                      </label>
                      <button
                        type="button"
                        onClick={() => setGuia(guia === campo ? null : campo)}
                        className="text-xs text-accent"
                        aria-label={`Cómo medir ${ETIQUETAS_MEDIDA[campo]}`}
                      >
                        ?
                      </button>
                    </div>
                    <input
                      id={campo}
                      name={campo}
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min={10}
                      max={250}
                      placeholder={ultima?.[campo] != null ? String(ultima[campo]) : "—"}
                      className="input px-2 py-1.5 text-sm"
                    />
                    {guia === campo ? <p className="mt-1 text-xs text-muted">{GUIA_MEDIDA[campo]}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div>
            <label htmlFor="notas" className="label">
              Notas (opcional)
            </label>
            <input id="notas" name="notas" type="text" maxLength={300} className="input" placeholder="Ej: medido en ayunas" />
          </div>

          {estado.error ? <p className="text-sm font-medium text-danger">✗ {estado.error}</p> : null}
          {estado.ok ? <p className="text-sm font-medium text-ok">✓ Medidas guardadas.</p> : null}
          <BotonGuardar pending={pendiente} />
        </form>
      ) : null}
    </section>
  );
}
