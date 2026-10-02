"use client";

import { useMemo, useState } from "react";
import { buscarAlimentos, crearIngredienteManual } from "@/app/actions/nutricion";
import type { RecomendacionPreparada } from "@/lib/comidas-service";
import { fmtHora } from "@/lib/hoy";
import { ajustarAMacros, chocaCon, notaUtil, totalesDe } from "@/lib/meal-plan";
import { ETIQUETAS_TIPO_DIA, macrosDe, nombreMomento, sumarMacros, type Macros } from "@/lib/nutrition";
import type { Ingredient, ItemComidaResuelto, Momento, TipoDia } from "@/lib/types";

const TIPOS: TipoDia[] = ["entreno", "descanso"];
const MOMENTOS: Momento[] = ["pre_entreno", "post_entreno", "desayuno", "snack", "almuerzo", "merienda", "cena"];

// De dónde viene lo que se edita
export type ModoEditor = "ia" | "txt" | "editar" | "ajuste";

const SUBTITULO: Record<ModoEditor, string> = {
  ia: "Generado con IA y cuadrado con la referencia",
  txt: "Leído de tu texto, tal cual",
  editar: "El menú actual del cliente",
  ajuste: "Ajustado a la referencia: la IA propuso los cambios y los gramos se cuadraron con los macros"
};

function fmt(m: Macros) {
  return `${Math.round(m.kcal)} kcal · P ${Math.round(m.prot_g)} · C ${Math.round(m.carb_g)} · G ${Math.round(m.grasa_g)}`;
}

// Diferencia de un macro contra la meta: "+12 g" en rojo si pasa de 10 %
function Delta({ valor, meta, unidad }: { valor: number; meta: number; unidad: string }) {
  if (!meta) return null;
  const d = Math.round(valor - meta);
  const lejos = Math.abs(valor - meta) / meta > 0.1;
  return (
    <span className={lejos ? "text-warn" : "text-ok"}>
      {d > 0 ? "+" : ""}
      {d} {unidad}
    </span>
  );
}

// Editor del menú (vista previa antes de guardar): gramos, cambiar,
// quitar y agregar alimentos, crear uno que no esté en la base, cuadrar
// los gramos con la referencia y ver lo que el cliente no come.
export default function EditorMenu({
  preview,
  modo,
  pendiente,
  evitar,
  guardada = false,
  onReleer,
  onDescartar,
  onAplicar
}: {
  preview: RecomendacionPreparada;
  modo: ModoEditor;
  pendiente: boolean;
  evitar: string[]; // lo que el cliente no come o le da alergia
  guardada?: boolean; // la lectura de este texto ya estaba guardada
  onReleer?: () => void;
  onDescartar: () => void;
  onAplicar: (plan: RecomendacionPreparada["plan"], usarObjetivos: boolean) => void;
}) {
  const [items, setItems] = useState<ItemComidaResuelto[]>(preview.plan.items);
  const [tipo, setTipo] = useState<TipoDia>("entreno");
  const [buscando, setBuscando] = useState<number | Momento | null>(null); // índice a cambiar o momento donde agregar
  const [resultados, setResultados] = useState<Ingredient[]>([]);
  const [q, setQ] = useState("");
  const objetivosTexto = preview.plan.objetivos;
  const [usarObjetivos, setUsarObjetivos] = useState(!!objetivosTexto);
  const [nuevo, setNuevo] = useState<{ nombre: string; kcal: string; prot: string; carb: string; grasa: string } | null>(null);
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null);
  const [cuadrado, setCuadrado] = useState<string | null>(null);

  const metas: Record<TipoDia, Macros> = usarObjetivos && objetivosTexto ? objetivosTexto : preview.objetivos;
  const totales = useMemo(() => ({ entreno: totalesDe(items, "entreno"), descanso: totalesDe(items, "descanso") }), [items]);
  const sinResolver = items.filter((i) => !i.ingredient).length;
  const choques = items.filter((i) => chocaCon(i.ingredient?.nombre ?? i.nombre_pedido, evitar));

  function actualizar(idx: number, cambios: Partial<ItemComidaResuelto>) {
    setItems((lista) => lista.map((i, k) => (k === idx ? { ...i, ...cambios } : i)));
  }

  function abrirBusqueda(destino: number | Momento, texto: string) {
    setBuscando(buscando === destino ? null : destino);
    setNuevo(null);
    setResultados([]);
    setQ(texto);
    if (texto) buscar(texto);
  }

  async function buscar(texto: string) {
    setQ(texto);
    if (texto.trim().length < 2) return setResultados([]);
    const r = await buscarAlimentos(texto);
    setResultados(r.resultados.slice(0, 6));
  }

  // Elegido en la búsqueda: cambia el alimento o lo agrega a la comida
  function elegido(ing: Ingredient) {
    if (typeof buscando === "number") actualizar(buscando, { ingredient: ing });
    else if (buscando) {
      const momento = buscando;
      setItems((lista) => {
        const ultimo = lista.reduce((u, i, k) => (i.tipo_dia === tipo && i.momento === momento ? k : u), -1);
        const plato = ultimo >= 0 ? lista[ultimo].plato : "";
        const nuevoItem: ItemComidaResuelto = {
          tipo_dia: tipo,
          momento,
          orden: 0,
          plato,
          nombre_pedido: ing.nombre,
          ingredient: ing,
          cantidad_g: 100,
          nota: null
        };
        const en = ultimo >= 0 ? ultimo + 1 : lista.length;
        return [...lista.slice(0, en), nuevoItem, ...lista.slice(en)];
      });
    }
    setBuscando(null);
    setNuevo(null);
  }

  // Un alimento que no está en la base: se crea con los macros de su etiqueta
  async function crear() {
    if (!nuevo) return;
    setErrorNuevo(null);
    const r = await crearIngredienteManual({
      nombre: nuevo.nombre,
      kcal_100: Number(nuevo.kcal),
      prot_100: Number(nuevo.prot),
      carb_100: Number(nuevo.carb),
      grasa_100: Number(nuevo.grasa)
    });
    if (r.error || !r.ingrediente) return setErrorNuevo(r.error ?? "No se pudo crear.");
    elegido(r.ingrediente);
  }

  // Los gramos se cuadran con la referencia de los dos tipos de día
  function cuadrar() {
    const antes = { entreno: totales.entreno.kcal, descanso: totales.descanso.kcal };
    const nuevos = ajustarAMacros(items, metas);
    setItems(nuevos);
    const e = totalesDe(nuevos, "entreno").kcal;
    const d = totalesDe(nuevos, "descanso").kcal;
    setCuadrado(`Entreno ${Math.round(antes.entreno)} → ${Math.round(e)} kcal · descanso ${Math.round(antes.descanso)} → ${Math.round(d)} kcal`);
  }

  const meta = metas[tipo];
  const total = totales[tipo];
  const delTipo = items.map((i, idx) => ({ i, idx })).filter(({ i }) => i.tipo_dia === tipo);
  const horas = preview.plan.horarios?.[tipo] ?? {};
  const momentos = MOMENTOS.filter((m) => delTipo.some(({ i }) => i.momento === m)).sort(
    (a, b) => (horas[a] ?? "99").localeCompare(horas[b] ?? "99") || MOMENTOS.indexOf(a) - MOMENTOS.indexOf(b)
  );
  const hayMeta = !!(metas.entreno.kcal || metas.descanso.kcal);

  const panelBusqueda = (
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
            <button type="button" onClick={() => elegido(r)} className="w-full py-1 text-left text-sm">
              {r.nombre}
              {r.marca ? <span className="text-muted"> · {r.marca}</span> : null}
              <span className="text-xs text-muted">
                {" "}
                · {r.kcal_100} kcal · P {r.prot_100} · C {r.carb_100} · G {r.grasa_100} /100 g
              </span>
            </button>
          </li>
        ))}
      </ul>
      {nuevo ? (
        <div className="mt-2 flex flex-col gap-1.5 border-t border-line pt-2">
          <p className="text-xs text-muted">Nuevo alimento: macros por 100 g (de su etiqueta)</p>
          <input
            className="input py-1.5 text-sm"
            value={nuevo.nombre}
            maxLength={80}
            aria-label="Nombre del alimento"
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
          />
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                ["kcal", "kcal"],
                ["prot", "Prot g"],
                ["carb", "Carb g"],
                ["grasa", "Grasa g"]
              ] as const
            ).map(([k, t]) => (
              <label key={k} className="text-[11px] text-muted">
                {t}
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  className="input mt-0.5 px-2 py-1 text-sm"
                  value={nuevo[k]}
                  onChange={(e) => setNuevo({ ...nuevo, [k]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={crear}
              disabled={!nuevo.nombre.trim() || nuevo.kcal === ""}
              className="btn-primary flex-1 py-1.5 text-sm"
            >
              Crear y usar
            </button>
            <button type="button" onClick={() => setNuevo(null)} className="btn-ghost py-1.5 text-sm">
              Cancelar
            </button>
          </div>
          {errorNuevo ? <p className="text-xs text-danger">✗ {errorNuevo}</p> : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setErrorNuevo(null);
            setNuevo({ nombre: q, kcal: "", prot: "", carb: "", grasa: "" });
          }}
          className="mt-1 text-xs font-semibold text-accent"
        >
          ¿No está? Créalo con su etiqueta
        </button>
      )}
    </div>
  );

  return (
    <section className="card border-accent/50">
      <h2 className="font-bold">
        {modo === "editar" ? "Editar" : "Vista previa"}: {preview.plan.nombre}
      </h2>
      <p className="mt-0.5 text-xs text-muted">{SUBTITULO[modo]} · toca los gramos para ajustar</p>
      {onReleer ? (
        <p className="mt-1 text-xs text-muted">
          {guardada ? "Es la lectura guardada de este texto: el mismo texto da siempre el mismo menú. " : ""}
          <button type="button" onClick={onReleer} disabled={pendiente} className="font-semibold text-accent">
            Leer el texto de nuevo con IA
          </button>
        </p>
      ) : null}
      {preview.aviso ? <p className="mt-2 rounded-xl border border-warn/50 px-3 py-2 text-sm text-warn">{preview.aviso}</p> : null}
      {preview.cambios?.length ? (
        <div className="mt-2 rounded-xl border border-line px-3 py-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Qué cambió la IA</p>
          <ul className="mt-1 list-disc pl-4 text-muted">
            {preview.cambios.map((c, k) => (
              <li key={k}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
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
          {fmt(total)}
        </p>
        {meta.kcal ? (
          <>
            <p>
              <span className="text-muted">{usarObjetivos && objetivosTexto ? "Objetivo de tu texto: " : "Referencia: "}</span>
              {fmt(meta)}
            </p>
            <p className="text-xs">
              <span className="text-muted">Diferencia: </span>
              <Delta valor={total.kcal} meta={meta.kcal} unidad="kcal" /> · P <Delta valor={total.prot_g} meta={meta.prot_g} unidad="g" /> · C{" "}
              <Delta valor={total.carb_g} meta={meta.carb_g} unidad="g" /> · G <Delta valor={total.grasa_g} meta={meta.grasa_g} unidad="g" />
            </p>
          </>
        ) : null}
        {hayMeta ? (
          <button type="button" onClick={cuadrar} disabled={pendiente} className="btn-ghost mt-2 w-full py-1.5 text-sm">
            Cuadrar gramos con la referencia
          </button>
        ) : null}
        {cuadrado ? (
          <p className="mt-1 text-xs text-ok">
            ✓ {cuadrado}. Se escalaron carnes, carbohidratos y grasas; verduras y lo que va por piezas quedan igual.
          </p>
        ) : null}
      </div>

      {objetivosTexto ? (
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={usarObjetivos} onChange={(e) => setUsarObjetivos(e.target.checked)} className="mt-1" />
          <span>
            Usar los objetivos de tu texto como referencia diaria del cliente (entreno {objetivosTexto.entreno.kcal} kcal ·
            descanso {objetivosTexto.descanso.kcal} kcal)
          </span>
        </label>
      ) : null}

      {choques.length ? (
        <p className="mt-2 rounded-xl border border-warn/50 px-3 py-2 text-sm text-warn">
          ⚠ El cliente dijo que no come o no debe comer:{" "}
          {[...new Set(choques.map((i) => `${i.ingredient?.nombre ?? i.nombre_pedido} (${chocaCon(i.ingredient?.nombre ?? i.nombre_pedido, evitar)})`))].join(", ")}.
          Cámbialo si hace falta.
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        {momentos.map((m) => {
          const lista = delTipo.filter(({ i }) => i.momento === m);
          const sub = sumarMacros(lista.filter(({ i }) => i.ingredient).map(({ i }) => macrosDe(i.ingredient!, i.cantidad_g)));
          const plato = lista.find(({ i }) => i.plato)?.i.plato;
          return (
            <div key={m} className="rounded-xl border border-line p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {horas[m] ? `${fmtHora(horas[m]!)} · ` : ""}
                  {nombreMomento(m)}
                  {plato ? ` · ${plato}` : ""}
                </p>
                <span className="shrink-0 text-[11px] text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(sub.kcal)} kcal · P {Math.round(sub.prot_g)}
                </span>
              </div>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {lista.map(({ i, idx }) => {
                  const choque = chocaCon(i.ingredient?.nombre ?? i.nombre_pedido, evitar);
                  return (
                    <li key={idx} className="text-sm">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          {i.ingredient ? (
                            <p className="truncate">
                              {i.ingredient.nombre}
                              {choque ? <span className="ml-1 text-xs text-warn">⚠ {choque}</span> : null}
                            </p>
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
                          aria-label={`Gramos de ${i.ingredient?.nombre ?? i.nombre_pedido}`}
                          onChange={(e) => actualizar(idx, { cantidad_g: Number(e.target.value) })}
                          className="input w-20 px-2 py-1 text-right text-sm"
                        />
                        <span className="text-xs text-muted">g</span>
                        <button
                          type="button"
                          onClick={() => abrirBusqueda(idx, i.ingredient ? "" : i.nombre_pedido)}
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
                      {buscando === idx ? panelBusqueda : null}
                    </li>
                  );
                })}
              </ul>
              <button type="button" onClick={() => abrirBusqueda(m, "")} className="mt-1.5 text-xs font-semibold text-accent">
                + agregar alimento
              </button>
              {buscando === m ? panelBusqueda : null}
            </div>
          );
        })}
      </div>

      {sinResolver ? (
        <p className="mt-2 text-sm text-warn">
          {sinResolver} alimento{sinResolver === 1 ? "" : "s"} sin encontrar en la base: toca “buscar” para elegir otro
          parecido o crearlo con su etiqueta, o quíta{sinResolver === 1 ? "lo" : "los"}. Lo que crees queda en la base
          para la próxima vez.
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onDescartar} className="btn-ghost flex-1" disabled={pendiente}>
          {modo === "editar" ? "Cancelar" : "Descartar"}
        </button>
        <button
          type="button"
          onClick={() => onAplicar({ ...preview.plan, items }, usarObjetivos)}
          className="btn-primary flex-1"
          disabled={pendiente || sinResolver > 0 || items.length === 0}
        >
          {pendiente ? "Guardando…" : "Guardar como borrador"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        El cliente sigue viendo su menú actual hasta que envíes el borrador.
      </p>
    </section>
  );
}
