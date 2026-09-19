"use client";

import { useState, useTransition } from "react";
import { aprobarInforme, regenerarInforme } from "@/app/actions/checkin";
import type { Checkin } from "@/lib/types";

const ETIQUETA_1A5 = ["", "muy baja", "baja", "normal", "buena", "muy buena"];

// Check-ins del cliente con el borrador de la IA: el entrenador lo edita
// si quiere y lo aprueba; recién ahí el cliente lo ve "de su parte".
export default function InformesEntrenador({
  checkins,
  textoInicial
}: {
  checkins: Checkin[];
  textoInicial: Record<string, string>; // borrador en texto por check-in
}) {
  const [textos, setTextos] = useState(textoInicial);
  const [abierto, setAbierto] = useState<string | null>(
    checkins.find((c) => c.informe_estado !== "aprobado")?.id ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (!checkins.length) return null;

  function aprobar(c: Checkin) {
    setError(null);
    setOk(null);
    iniciar(async () => {
      const r = await aprobarInforme({ checkinId: c.id, texto: textos[c.id] ?? "" });
      if (r.error) setError(r.error);
      else setOk(`Informe de la semana ${c.semana} enviado.`);
    });
  }

  function regenerar(c: Checkin) {
    setError(null);
    iniciar(async () => {
      const r = await regenerarInforme({ checkinId: c.id });
      if (r.error || !r.informe) setError(r.error ?? "No se pudo regenerar.");
      else setTextos((t) => ({ ...t, [c.id]: r.informe! }));
    });
  }

  return (
    <section className="card">
      <h2 className="font-bold">Check-ins e informes</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {checkins.map((c) => {
          const r = c.resumen;
          const esteAbierto = abierto === c.id;
          return (
            <li key={c.id} className={`rounded-xl border p-3 ${c.informe_estado === "borrador" ? "border-warn/50" : "border-line"}`}>
              <button type="button" onClick={() => setAbierto(esteAbierto ? null : c.id)} className="flex w-full items-center justify-between gap-2 text-left">
                <div>
                  <p className="font-semibold">
                    Semana {c.semana}
                    <span className="ml-2 text-xs font-normal text-muted">
                      {new Date(`${c.fecha}T12:00:00`).toLocaleDateString("es-AR")}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {c.peso_kg != null ? `${c.peso_kg} kg` : "sin peso"}
                    {c.cintura_cm != null ? ` · cintura ${c.cintura_cm} cm` : ""} · energía {ETIQUETA_1A5[c.energia ?? 3]} · sueño{" "}
                    {ETIQUETA_1A5[c.sueno ?? 3]} · plan {ETIQUETA_1A5[c.adherencia ?? 3]}
                  </p>
                </div>
                <span
                  className={`chip shrink-0 ${
                    c.informe_estado === "aprobado" ? "border-ok/40 text-ok" : c.informe_estado === "borrador" ? "border-warn/40 text-warn" : "border-line text-muted"
                  }`}
                >
                  {c.informe_estado === "aprobado" ? (c.visto_at ? "leído" : "enviado") : c.informe_estado === "borrador" ? "por aprobar" : "sin borrador"}
                </span>
              </button>

              {esteAbierto ? (
                <div className="mt-3 text-sm">
                  {r ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted">
                      <dt>Entrenos</dt>
                      <dd className="text-ink">
                        {r.entrenos_hechos}/{r.entrenos_planificados} · {r.series_registradas} series
                      </dd>
                      <dt>Comidas</dt>
                      <dd className="text-ink">
                        {r.comidas_menu_esperadas ? `${r.comidas_menu_hechas}/${r.comidas_menu_esperadas} del menú · ` : ""}
                        {r.dias_con_registro_comida}/7 días con registro
                        {r.kcal_promedio != null ? ` · ${r.kcal_promedio} kcal y ${r.prot_promedio} g prot promedio (ref. ${r.kcal_referencia} / ${r.prot_referencia})` : ""}
                      </dd>
                      <dt>Cargas</dt>
                      <dd className="text-ink">
                        {r.mejoras_carga.length ? r.mejoras_carga.map((m) => `${m.ejercicio} ${m.antes_kg}→${m.ahora_kg}`).join(", ") : "sin subidas"}
                      </dd>
                      <dt>Peso</dt>
                      <dd className="text-ink">
                        {r.peso_anterior_kg != null ? `${r.peso_anterior_kg} → ` : ""}
                        {r.peso_actual_kg ?? c.peso_kg} kg
                      </dd>
                    </dl>
                  ) : null}
                  {c.comentario ? <p className="mt-2 italic text-muted">&ldquo;{c.comentario}&rdquo;</p> : null}

                  {c.informe_estado === "aprobado" ? (
                    <div className="mt-3 whitespace-pre-line rounded-lg bg-surface2 p-3 text-sm">{c.informe_final}</div>
                  ) : (
                    <>
                      <label className="label mt-3">Informe (borrador de la IA, editalo como quieras)</label>
                      <textarea
                        value={textos[c.id] ?? ""}
                        onChange={(e) => setTextos((t) => ({ ...t, [c.id]: e.target.value }))}
                        rows={12}
                        className="input text-sm"
                        placeholder="Sin borrador todavía. Escribilo o pedíselo a la IA."
                      />
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => regenerar(c)} disabled={pendiente} className="btn-ghost flex-1 py-1.5 text-sm">
                          {pendiente ? "…" : "Pedir otro borrador"}
                        </button>
                        <button type="button" onClick={() => aprobar(c)} disabled={pendiente || (textos[c.id] ?? "").trim().length < 20} className="btn-primary flex-1 py-1.5 text-sm">
                          Aprobar y enviar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
      {ok ? <p className="mt-2 text-sm font-medium text-ok">✓ {ok}</p> : null}
    </section>
  );
}
