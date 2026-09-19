"use client";

import { useMemo, useState, useTransition } from "react";
import {
  aplicarComidas,
  generarComidasIA,
  guardarMacrosManual,
  interpretarComidasTxtAction,
  quitarComidas
} from "@/app/actions/comidas";
import { buscarAlimentos } from "@/app/actions/nutricion";
import type { RecomendacionPreparada } from "@/lib/comidas-service";
import { notaUtil } from "@/lib/meal-plan";
import { ETIQUETAS_TIPO_DIA, macrosDe, nombreMomento, sumarMacros, type Macros } from "@/lib/nutrition";
import type { Ingredient, ItemComidaResuelto, MacrosManual, Momento, TipoDia } from "@/lib/types";

const TIPOS: TipoDia[] = ["entreno", "descanso"];
const MOMENTOS: Momento[] = ["desayuno", "almuerzo", "merienda", "cena", "snack"];

function fmtMacros(m: Macros) {
  return `${m.kcal} kcal · P ${Math.round(m.prot_g)} · C ${Math.round(m.carb_g)} · G ${Math.round(m.grasa_g)}`;
}

// Panel del entrenador: referencia diaria (fórmula o a mano), generar la
// recomendación con IA o desde un .txt, revisarla y aplicarla.
export default function RecomendacionComidas({
  userId,
  conIA,
  objetivos,
  macrosManual,
  tienePlan,
  nombrePlan
}: {
  userId: string;
  conIA: boolean;
  objetivos: Record<TipoDia, Macros> | null;
  macrosManual: MacrosManual | null;
  tienePlan: boolean;
  nombrePlan: string | null;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [modoTxt, setModoTxt] = useState(false);
  const [texto, setTexto] = useState("");
  const [preview, setPreview] = useState<{ r: RecomendacionPreparada; origen: "ia" | "txt" } | null>(null);
  const [editandoMacros, setEditandoMacros] = useState(false);

  function correr(fn: () => Promise<{ error?: string }>, mensajeOk?: string) {
    setError(null);
    setOk(null);
    iniciar(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else if (mensajeOk) setOk(mensajeOk);
    });
  }

  function generar() {
    setError(null);
    setOk(null);
    iniciar(async () => {
      const r = await generarComidasIA({ userId });
      if (r.error || !r.resultado) setError(r.error ?? "No se pudo generar.");
      else setPreview({ r: r.resultado, origen: "ia" });
    });
  }

  function interpretar() {
    setError(null);
    setOk(null);
    iniciar(async () => {
      const r = await interpretarComidasTxtAction({ userId, texto });
      if (r.error || !r.resultado) setError(r.error ?? "No se pudo interpretar.");
      else setPreview({ r: r.resultado, origen: "txt" });
    });
  }

  async function leerArchivo(f: File | undefined) {
    if (!f) return;
    setTexto(await f.text());
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="card">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-bold">Referencia diaria</h2>
          <span className="text-xs text-muted">{macrosManual ? "fijada a mano" : "por fórmula"}</span>
        </div>
        {objetivos ? (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {TIPOS.map((t) => (
              <TipoFila key={t} tipo={t} macros={objetivos[t]} />
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-warn">
            Faltan edad, sexo, peso o altura del cliente. Podés fijar la referencia a mano.
          </p>
        )}
        {editandoMacros ? (
          <MacrosManualForm
            inicial={macrosManual ?? (objetivos ? { entreno: objetivos.entreno, descanso: objetivos.descanso } : null)}
            pendiente={pendiente}
            onGuardar={(m) =>
              correr(async () => {
                const r = await guardarMacrosManual({ userId, macros: m });
                if (!r.error) setEditandoMacros(false);
                return r;
              }, "Referencia guardada.")
            }
            onCancelar={() => setEditandoMacros(false)}
          />
        ) : (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setEditandoMacros(true)} className="btn-ghost flex-1 py-1.5 text-sm">
              {macrosManual ? "Editar a mano" : "Fijar a mano"}
            </button>
            {macrosManual ? (
              <button
                type="button"
                disabled={pendiente}
                onClick={() => correr(() => guardarMacrosManual({ userId, macros: null }), "Vuelve a la fórmula.")}
                className="btn-ghost flex-1 py-1.5 text-sm"
              >
                Volver a la fórmula
              </button>
            ) : null}
          </div>
        )}
      </section>

      {!preview ? (
        <section className="card">
          <h2 className="font-bold">{tienePlan ? "Reemplazar la recomendación" : "Crear la recomendación de comidas"}</h2>
          <p className="mt-1 text-sm text-muted">
            Un menú para día de entreno y otro para descanso, con los momentos y horarios que eligió el
            cliente. Antes de aplicarlo ves y editás cada ingrediente.
          </p>
          {!conIA ? (
            <p className="mt-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
              Falta configurar la IA (GROQ_API_KEY): sin ella no se puede generar ni interpretar.
            </p>
          ) : null}
          {!modoTxt ? (
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={generar} disabled={pendiente || !conIA || !objetivos} className="btn-primary flex-1">
                {pendiente ? "Generando…" : "Generar con IA"}
              </button>
              <button type="button" onClick={() => setModoTxt(true)} className="btn-ghost flex-1">
                Cargar .txt
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <input
                type="file"
                accept=".txt,text/plain,.md"
                onChange={(e) => leerArchivo(e.target.files?.[0])}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface2 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink"
              />
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={10}
                className="input mt-3 font-mono text-sm"
                placeholder={`Día de entreno\nDesayuno: 2 huevos, 60g avena, 1 banana\nAlmuerzo: 150g pollo, 100g arroz cocido, ensalada\nMerienda: yogur 200g + 30g granola\nCena: 150g merluza, 200g batata\n\nDía de descanso\n...`}
              />
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setModoTxt(false)} className="btn-ghost flex-1" disabled={pendiente}>
                  Volver
                </button>
                <button
                  type="button"
                  onClick={interpretar}
                  disabled={pendiente || !conIA || texto.trim().length < 20}
                  className="btn-primary flex-1"
                >
                  {pendiente ? "Interpretando…" : "Interpretar con IA"}
                </button>
              </div>
            </div>
          )}
          {tienePlan ? (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => {
                if (!window.confirm(`¿Quitar "${nombrePlan ?? "la recomendación"}"? El cliente deja de ver el menú.`)) return;
                correr(() => quitarComidas({ userId }), "Recomendación quitada.");
              }}
              className="mt-3 w-full text-center text-sm text-danger"
            >
              Quitar la recomendación actual
            </button>
          ) : null}
        </section>
      ) : (
        <VistaPrevia
          preview={preview.r}
          origen={preview.origen}
          pendiente={pendiente}
          onDescartar={() => setPreview(null)}
          onAplicar={(plan) =>
            correr(async () => {
              const r = await aplicarComidas({ userId, plan, origen: preview.origen });
              if (!r.error) {
                setPreview(null);
                setTexto("");
                setModoTxt(false);
              }
              return r;
            }, "Recomendación aplicada. El cliente ya la ve en Comida.")
          }
        />
      )}

      {error ? <p className="text-sm font-medium text-danger">✗ {error}</p> : null}
      {ok ? <p className="text-sm font-medium text-ok">✓ {ok}</p> : null}
    </div>
  );
}

function TipoFila({ tipo, macros }: { tipo: TipoDia; macros: Macros }) {
  return (
    <>
      <dt className="text-muted">{ETIQUETAS_TIPO_DIA[tipo]}</dt>
      <dd style={{ fontVariantNumeric: "tabular-nums" }}>{fmtMacros(macros)}</dd>
    </>
  );
}

// ── Referencia a mano ───────────────────────────────────────────

function MacrosManualForm({
  inicial,
  pendiente,
  onGuardar,
  onCancelar
}: {
  inicial: MacrosManual | null;
  pendiente: boolean;
  onGuardar: (m: MacrosManual) => void;
  onCancelar: () => void;
}) {
  const vacio = { kcal: 2200, prot_g: 150, carb_g: 250, grasa_g: 65 };
  const [m, setM] = useState<MacrosManual>(inicial ?? { entreno: vacio, descanso: { ...vacio, kcal: 2000, carb_g: 200 } });
  const campos: { k: keyof Macros; t: string }[] = [
    { k: "kcal", t: "kcal" },
    { k: "prot_g", t: "Prot g" },
    { k: "carb_g", t: "Carb g" },
    { k: "grasa_g", t: "Grasa g" }
  ];
  return (
    <div className="mt-3 flex flex-col gap-3">
      {TIPOS.map((t) => (
        <div key={t}>
          <p className="label">{ETIQUETAS_TIPO_DIA[t]}</p>
          <div className="grid grid-cols-4 gap-2">
            {campos.map((c) => (
              <label key={c.k} className="text-xs text-muted">
                {c.t}
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={m[t][c.k]}
                  onChange={(e) => setM({ ...m, [t]: { ...m[t], [c.k]: Number(e.target.value) } })}
                  className="input mt-0.5 px-2 py-1.5 text-sm"
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} className="btn-ghost flex-1 py-1.5 text-sm" disabled={pendiente}>
          Cancelar
        </button>
        <button type="button" onClick={() => onGuardar(m)} className="btn-primary flex-1 py-1.5 text-sm" disabled={pendiente}>
          Guardar
        </button>
      </div>
    </div>
  );
}

// ── Vista previa editable ───────────────────────────────────────

function VistaPrevia({
  preview,
  origen,
  pendiente,
  onDescartar,
  onAplicar
}: {
  preview: RecomendacionPreparada;
  origen: "ia" | "txt";
  pendiente: boolean;
  onDescartar: () => void;
  onAplicar: (plan: RecomendacionPreparada["plan"]) => void;
}) {
  const [items, setItems] = useState<ItemComidaResuelto[]>(preview.plan.items);
  const [tipo, setTipo] = useState<TipoDia>("entreno");
  const [buscando, setBuscando] = useState<number | null>(null);
  const [resultados, setResultados] = useState<Ingredient[]>([]);
  const [q, setQ] = useState("");

  const sinResolver = items.filter((i) => !i.ingredient).length;
  const totales = useMemo(() => {
    const de = (t: TipoDia) =>
      sumarMacros(items.filter((i) => i.tipo_dia === t && i.ingredient).map((i) => macrosDe(i.ingredient!, i.cantidad_g)));
    return { entreno: de("entreno"), descanso: de("descanso") };
  }, [items]);

  function actualizar(idx: number, cambios: Partial<ItemComidaResuelto>) {
    setItems((lista) => lista.map((i, k) => (k === idx ? { ...i, ...cambios } : i)));
  }

  async function buscar(texto: string) {
    setQ(texto);
    if (texto.trim().length < 2) return setResultados([]);
    const r = await buscarAlimentos(texto);
    setResultados(r.resultados.slice(0, 6));
  }

  const meta = preview.objetivos[tipo];
  const desvio = meta.kcal ? Math.round(((totales[tipo].kcal - meta.kcal) / meta.kcal) * 100) : 0;
  const delTipo = items.map((i, idx) => ({ i, idx })).filter(({ i }) => i.tipo_dia === tipo);
  const momentos = MOMENTOS.filter((m) => delTipo.some(({ i }) => i.momento === m));

  return (
    <section className="card border-accent/50">
      <h2 className="font-bold">Vista previa: {preview.plan.nombre}</h2>
      <p className="mt-0.5 text-xs text-muted">
        {origen === "ia" ? "Generada con IA y cuadrada con la referencia" : "Interpretada de tu texto, tal cual"} · tocá los gramos para
        ajustar
      </p>
      {preview.plan.notas ? <p className="mt-1 text-sm text-muted">{preview.plan.notas}</p> : null}

      <div className="mt-3 flex gap-2">
        {TIPOS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={`chip flex-1 justify-center py-1.5 ${t === tipo ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"}`}
          >
            {ETIQUETAS_TIPO_DIA[t]}
          </button>
        ))}
      </div>

      <div className="mt-2 rounded-xl border border-line px-3 py-2 text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
        <p>
          <span className="text-muted">Menú: </span>
          {fmtMacros(totales[tipo])}
        </p>
        {meta.kcal ? (
          <p className={Math.abs(desvio) > 5 ? "text-warn" : "text-ok"}>
            <span className="text-muted">Referencia: </span>
            {fmtMacros(meta)} · {desvio > 0 ? "+" : ""}
            {desvio} %
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {momentos.map((m) => (
          <div key={m} className="rounded-xl border border-line p-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {nombreMomento(m)}
              {delTipo.find(({ i }) => i.momento === m && i.plato)?.i.plato
                ? ` · ${delTipo.find(({ i }) => i.momento === m && i.plato)!.i.plato}`
                : ""}
            </p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {delTipo
                .filter(({ i }) => i.momento === m)
                .map(({ i, idx }) => (
                  <li key={idx} className="text-sm">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        {i.ingredient ? (
                          <p className="truncate">{i.ingredient.nombre}</p>
                        ) : (
                          <p className="truncate text-warn">No encontrado: {i.nombre_pedido}</p>
                        )}
                        {notaUtil(i.ingredient?.nombre ?? "", i.nota) ? <p className="text-xs text-muted">{i.nota}</p> : null}
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={i.cantidad_g}
                        onChange={(e) => actualizar(idx, { cantidad_g: Number(e.target.value) })}
                        className="input w-20 px-2 py-1 text-right text-sm"
                      />
                      <span className="text-xs text-muted">g</span>
                      <button
                        type="button"
                        onClick={() => {
                          setBuscando(buscando === idx ? null : idx);
                          setQ(i.ingredient ? "" : i.nombre_pedido);
                          setResultados([]);
                          if (!i.ingredient) buscar(i.nombre_pedido);
                        }}
                        className="text-xs font-semibold text-accent"
                      >
                        {i.ingredient ? "cambiar" : "buscar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setItems((l) => l.filter((_, k) => k !== idx))}
                        className="text-xs font-semibold text-danger"
                      >
                        quitar
                      </button>
                    </div>
                    {buscando === idx ? (
                      <div className="mt-1.5 rounded-lg border border-line bg-surface2 p-2">
                        <input
                          type="search"
                          value={q}
                          onChange={(e) => buscar(e.target.value)}
                          placeholder="Buscar alimento…"
                          className="input py-1.5 text-sm"
                          autoFocus
                        />
                        <ul className="mt-1 flex flex-col">
                          {resultados.map((r) => (
                            <li key={r.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  actualizar(idx, { ingredient: r });
                                  setBuscando(null);
                                }}
                                className="w-full py-1 text-left text-sm"
                              >
                                {r.nombre}
                                {r.marca ? <span className="text-muted"> · {r.marca}</span> : null}
                                <span className="text-xs text-muted"> · {r.kcal_100} kcal/100 g</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      {sinResolver ? (
        <p className="mt-2 text-sm text-warn">
          {sinResolver} ingrediente{sinResolver === 1 ? "" : "s"} sin encontrar en la base: buscalo{sinResolver === 1 ? "" : "s"} o quitalo{sinResolver === 1 ? "" : "s"} para poder aplicar.
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onDescartar} className="btn-ghost flex-1" disabled={pendiente}>
          Descartar
        </button>
        <button
          type="button"
          onClick={() => onAplicar({ ...preview.plan, items })}
          className="btn-primary flex-1"
          disabled={pendiente || sinResolver > 0 || items.length === 0}
        >
          {pendiente ? "Aplicando…" : "Aplicar al cliente"}
        </button>
      </div>
    </section>
  );
}
