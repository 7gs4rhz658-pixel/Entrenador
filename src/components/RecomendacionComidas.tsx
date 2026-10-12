"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ajustarMenuAction,
  aplicarComidas,
  descartarBorradorMenuAction,
  generarComidasIA,
  guardarMacrosManual,
  interpretarComidasTxtAction,
  menuActualAction,
  quitarComidas
} from "@/app/actions/comidas";
import EditorMenu, { type ModoEditor } from "@/components/EditorMenu";
import type { RecomendacionPreparada } from "@/lib/comidas-service";
import { metasDelAjuste } from "@/lib/meal-plan";
import { ETIQUETAS_TIPO_DIA, type Macros } from "@/lib/nutrition";
import type { MacrosManual, TipoDia } from "@/lib/types";

const TIPOS: TipoDia[] = ["entreno", "descanso"];
const kcalValida = (k: number) => Number.isFinite(k) && k >= 1000 && k <= 6000;

function fmtMacros(m: Macros) {
  return `${Math.round(m.kcal)} kcal · P ${Math.round(m.prot_g)} · C ${Math.round(m.carb_g)} · G ${Math.round(m.grasa_g)}`;
}

// Panel del entrenador en la pestaña Comida: referencia diaria (fórmula o
// a mano), el menú actual (editarlo o llevarlo a otras calorías, solo
// gramos o con IA) y crear uno nuevo (con IA o desde el texto del plan).
// Todo se guarda como borrador; el cliente sigue con su menú hasta que lo
// envías.
export default function RecomendacionComidas({
  userId,
  conIA,
  objetivos,
  macrosManual,
  tienePlan,
  nombrePlan,
  origenPlan = null,
  borrador = false,
  hayEnviado = false,
  totalesMenu = null,
  evitar = [],
  desdeProtocolo = false
}: {
  userId: string;
  conIA: boolean;
  objetivos: Record<TipoDia, Macros> | null;
  macrosManual: MacrosManual | null;
  tienePlan: boolean;
  nombrePlan: string | null;
  origenPlan?: "ia" | "txt" | null;
  borrador?: boolean; // el menú que se ve acá es un borrador sin enviar
  hayEnviado?: boolean; // el cliente ya tiene un menú enviado
  totalesMenu?: Record<TipoDia, Macros> | null; // del menú actual
  evitar?: string[]; // lo que el cliente no come o le da alergia
  desdeProtocolo?: boolean; // viene de importar el plan en Protocolo: trae el mismo texto
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [modoTxt, setModoTxt] = useState(false);
  const [texto, setTexto] = useState("");
  const [preview, setPreview] = useState<{ r: RecomendacionPreparada; modo: ModoEditor; guardada?: boolean } | null>(null);
  const [lectura, setLectura] = useState(0); // cada lectura nueva rearma el editor
  const [editandoMacros, setEditandoMacros] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [kcalMeta, setKcalMeta] = useState<Record<TipoDia, string>>({ entreno: "", descanso: "" });
  const [conIAAjuste, setConIAAjuste] = useState(false);
  const [indicacion, setIndicacion] = useState("");
  const [cambiarEvitados, setCambiarEvitados] = useState(true);

  // El texto del plan que se importó en Protocolo, para sacar las comidas
  useEffect(() => {
    if (!desdeProtocolo) return;
    try {
      const t = sessionStorage.getItem(`plan-txt:${userId}`);
      if (t) {
        setModoTxt(true);
        setTexto(t);
        setOk("Traje el texto de tu plan: toca \"Interpretar con IA\" para pasar las comidas al menú.");
      }
    } catch {}
  }, [desdeProtocolo, userId]);

  function correr(fn: () => Promise<{ error?: string }>, mensajeOk?: string) {
    setError(null);
    setOk(null);
    iniciar(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else if (mensajeOk) setOk(mensajeOk);
    });
  }

  // Abre el editor con lo que devuelva la acción
  function abrir(fn: () => Promise<{ resultado?: RecomendacionPreparada; error?: string; lecturaGuardada?: boolean }>, modo: ModoEditor) {
    setError(null);
    setOk(null);
    iniciar(async () => {
      const r = await fn();
      if (r.error || !r.resultado) return setError(r.error ?? "No se pudo preparar el menú.");
      setLectura((n) => n + 1);
      setPreview({ r: r.resultado, modo, guardada: !!r.lecturaGuardada });
      setAjustando(false);
    });
  }

  async function leerArchivo(f: File | undefined) {
    if (!f) return;
    setTexto(await f.text());
  }

  const origenAlGuardar = (modo: ModoEditor): "ia" | "txt" =>
    modo === "txt" ? "txt" : modo === "editar" || modo === "cantidades" ? (origenPlan ?? "ia") : "ia";

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
            Faltan edad, sexo, peso o altura del cliente. Puedes fijar la referencia a mano.
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
              }, tienePlan ? "Referencia guardada. Si quieres que el menú llegue a estos números, usa “Ajustar calorías”." : "Referencia guardada.")
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

      {preview ? (
        <EditorMenu
          key={lectura}
          preview={preview.r}
          modo={preview.modo}
          pendiente={pendiente}
          evitar={evitar}
          guardada={!!preview.guardada}
          onReleer={
            preview.modo === "txt" ? () => abrir(() => interpretarComidasTxtAction({ userId, texto, releer: true }), "txt") : undefined
          }
          onDescartar={() => setPreview(null)}
          onAplicar={(plan, usarObjetivos) =>
            correr(async () => {
              const r = await aplicarComidas({ userId, plan, origen: origenAlGuardar(preview.modo), usarObjetivos });
              if (!r.error) {
                setPreview(null);
                setTexto("");
                setModoTxt(false);
              }
              return r;
            }, "Guardado como borrador. Revísalo abajo y envíalo desde arriba cuando esté bien.")
          }
        />
      ) : (
        <>
          {tienePlan ? (
            <section className="card">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-bold">Menú actual</h2>
                {borrador ? <span className="chip border-warn/40 text-xs text-warn">borrador sin enviar</span> : null}
              </div>
              {totalesMenu ? (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {TIPOS.map((t) => {
                    const meta = objetivos?.[t].kcal ?? 0;
                    const d = meta ? Math.round(((totalesMenu[t].kcal - meta) / meta) * 100) : null;
                    return (
                      <div key={t} className="contents">
                        <dt className="text-muted">{ETIQUETAS_TIPO_DIA[t]}</dt>
                        <dd>
                          {fmtMacros(totalesMenu[t])}
                          {d != null ? (
                            <span className={Math.abs(d) > 5 ? " text-warn" : " text-ok"}>
                              {" "}
                              ({d > 0 ? "+" : ""}
                              {d} % vs referencia)
                            </span>
                          ) : null}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => abrir(() => menuActualAction({ userId }), "editar")} disabled={pendiente} className="btn-ghost flex-1">
                  Editar el menú
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!ajustando && totalesMenu) {
                      const inicial = (t: TipoDia) => String(Math.round(objetivos?.[t].kcal || totalesMenu[t].kcal));
                      setKcalMeta({ entreno: inicial("entreno"), descanso: inicial("descanso") });
                    }
                    setAjustando((a) => !a);
                  }}
                  disabled={pendiente || !totalesMenu}
                  className="btn-primary flex-1"
                >
                  Ajustar calorías
                </button>
              </div>
              {ajustando && totalesMenu ? (
                <div className="mt-3 flex flex-col gap-3 rounded-xl border border-line p-3">
                  <p className="text-sm text-muted">
                    Escribe las calorías de cada tipo de día. Se quedan los mismos alimentos y solo cambian los gramos: la
                    proteína queda igual y la diferencia la absorben los carbohidratos y la grasa. Lo ves antes de guardar.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {TIPOS.map((t) => {
                      const kcal = Number(kcalMeta[t]);
                      const meta = kcalValida(kcal) ? metasDelAjuste(totalesMenu[t], objetivos?.[t] ?? null, kcal) : null;
                      return (
                        <label key={t} className="text-sm">
                          <span className="label">{ETIQUETAS_TIPO_DIA[t]}</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1000}
                            max={6000}
                            step={10}
                            value={kcalMeta[t]}
                            onChange={(e) => setKcalMeta({ ...kcalMeta, [t]: e.target.value })}
                            className="input"
                            aria-label={`Calorías del ${ETIQUETAS_TIPO_DIA[t].toLowerCase()}`}
                          />
                          <span className="mt-1 block text-xs text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {meta ? (
                              <>
                                ahora {Math.round(totalesMenu[t].kcal)} kcal
                                <br />
                                {meta === objetivos?.[t] ? "referencia" : "meta"}: P {Math.round(meta.prot_g)} · C {Math.round(meta.carb_g)} · G{" "}
                                {Math.round(meta.grasa_g)}
                              </>
                            ) : (
                              "Entre 1000 y 6000 kcal"
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {conIA ? (
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={conIAAjuste} onChange={(e) => setConIAAjuste(e.target.checked)} className="mt-1" />
                      <span>Dejar que la IA también cambie o agregue alimentos (no solo gramos)</span>
                    </label>
                  ) : null}
                  {conIA && conIAAjuste ? (
                    <label className="text-sm">
                      <span className="label">Indicación para la IA (opcional)</span>
                      <textarea
                        rows={2}
                        className="input text-sm"
                        value={indicacion}
                        maxLength={500}
                        onChange={(e) => setIndicacion(e.target.value)}
                        placeholder="Ej. sube carbohidratos antes y después de entrenar; no toques el desayuno"
                      />
                    </label>
                  ) : null}
                  {conIA && conIAAjuste && evitar.length ? (
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={cambiarEvitados} onChange={(e) => setCambiarEvitados(e.target.checked)} className="mt-1" />
                      <span>Cambiar lo que el cliente dijo que no come ({evitar.slice(0, 6).join(", ")})</span>
                    </label>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      abrir(
                        () =>
                          ajustarMenuAction({
                            userId,
                            indicacion,
                            cambiarEvitados,
                            kcal: { entreno: Number(kcalMeta.entreno), descanso: Number(kcalMeta.descanso) },
                            soloCantidades: !(conIA && conIAAjuste)
                          }),
                        conIA && conIAAjuste ? "ajuste" : "cantidades"
                      )
                    }
                    disabled={pendiente || !TIPOS.every((t) => kcalValida(Number(kcalMeta[t])))}
                    className="btn-primary"
                  >
                    {pendiente ? "Ajustando…" : conIA && conIAAjuste ? "Ajustar con IA" : "Ajustar cantidades"}
                  </button>
                </div>
              ) : null}
              {borrador && hayEnviado ? (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => {
                    if (window.confirm("¿Descartar el borrador? El cliente sigue con el menú que ya le enviaste."))
                      correr(() => descartarBorradorMenuAction({ userId }), "Borrador descartado.");
                  }}
                  className="mt-3 w-full text-center text-sm text-muted"
                >
                  Descartar el borrador (volver al menú enviado)
                </button>
              ) : null}
            </section>
          ) : null}

          <section className="card">
            <h2 className="font-bold">{tienePlan ? "Hacer un menú nuevo" : "Crear la recomendación de comidas"}</h2>
            <p className="mt-1 text-sm text-muted">
              Un menú para día de entreno y otro para descanso, con los momentos y horarios del cliente. Revisas y
              editas cada alimento, lo guardas como borrador y el cliente lo recibe cuando lo envías.
            </p>
            {!conIA ? (
              <p className="mt-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
                Falta configurar la IA (GROQ_API_KEY): sin ella no se puede generar ni interpretar.
              </p>
            ) : null}
            {!modoTxt ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => abrir(() => generarComidasIA({ userId }), "ia")}
                  disabled={pendiente || !conIA || !objetivos}
                  className="btn-primary flex-1"
                >
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
                  placeholder={`Día de entreno\n7:00 Desayuno: 2 huevos, 60 g avena, 1 plátano\n14:00 Comida: 150 g pollo, 150 g arroz cocido, ensalada\n17:00 Colación: yogur griego 200 g + 30 g granola\n21:00 Cena: 150 g pescado, 200 g camote\n\nDía de descanso\n...`}
                />
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setModoTxt(false)} className="btn-ghost flex-1" disabled={pendiente}>
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={() => abrir(() => interpretarComidasTxtAction({ userId, texto }), "txt")}
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
        </>
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
  // Las calorías que dan los macros (4/4/9): si no coinciden, se avisa
  const deMacros = (x: Macros) => Math.round(x.prot_g * 4 + x.carb_g * 4 + x.grasa_g * 9);
  return (
    <div className="mt-3 flex flex-col gap-3">
      {TIPOS.map((t) => {
        const calc = deMacros(m[t]);
        const dif = calc - m[t].kcal;
        return (
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
            {Math.abs(dif) > 30 ? (
              <p className="mt-1 text-xs text-warn">
                Con estos macros salen {calc} kcal ({dif > 0 ? "+" : ""}
                {dif}).{" "}
                <button
                  type="button"
                  onClick={() => setM({ ...m, [t]: { ...m[t], kcal: calc } })}
                  className="font-semibold text-accent"
                >
                  Usar {calc} kcal
                </button>
              </p>
            ) : null}
          </div>
        );
      })}
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
