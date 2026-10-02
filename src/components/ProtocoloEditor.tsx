"use client";

import { useState, useTransition } from "react";
import {
  borrarItemProtocolo,
  descartarCambiosProtocolo,
  enviarProtocolo,
  guardarDatosProtocolo,
  guardarItemProtocolo,
  moverItemProtocolo,
  quitarProtocoloCliente
} from "@/app/actions/protocolo";
import type { ProtocoloActivo } from "@/lib/data";
import { aHora, aplicaHoy, fmtHora, horaDelItem, horarioDelDia } from "@/lib/hoy";
import { ANCLAS, SEGMENTOS, textoCuando, textoCuandoAplica, textoDiasFase, type ItemEntrada } from "@/lib/protocolo";
import type { CuestionarioNutricion, FaseProtocolo, HorariosMenu, ProtocoloItem } from "@/lib/types";

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];

const NUEVO: ItemEntrada = {
  segmento: "Suplementos",
  titulo: "",
  detalle: "",
  porque: null,
  ancla: "al_despertar",
  offset_min: 0,
  hora: null,
  dias: [1, 2, 3, 4, 5, 6, 7],
  aplica: "todos",
  semana_desde: null,
  semana_hasta: null,
  fase_desde: null,
  fase_hasta: null
};

function desdeItem(i: ProtocoloItem): ItemEntrada {
  return {
    segmento: i.segmento,
    titulo: i.titulo,
    detalle: i.detalle,
    porque: i.porque,
    ancla: i.ancla,
    offset_min: i.offset_min,
    hora: i.hora ? i.hora.slice(0, 5) : null,
    dias: i.dias,
    aplica: i.aplica,
    semana_desde: i.semana_desde,
    semana_hasta: i.semana_hasta,
    fase_desde: i.fase_desde,
    fase_hasta: i.fase_hasta
  };
}

// Protocolo del cliente (suplementos, hábitos, cara, cabello…) en la
// ficha del entrenador. Se edita un borrador; el cliente lo ve al enviarlo.
export default function ProtocoloEditor({
  userId,
  borrador,
  publicado,
  cn,
  horarios = null
}: {
  userId: string;
  borrador: ProtocoloActivo | null;
  publicado: ProtocoloActivo | null;
  cn: CuestionarioNutricion | null;
  horarios?: HorariosMenu | null; // horas del menú por tipo de día
}) {
  const actual = borrador ?? publicado;
  const items = actual?.items ?? [];
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | "nuevo" | null>(null);
  const [form, setForm] = useState<ItemEntrada>(NUEVO);
  const [segmentoLibre, setSegmentoLibre] = useState(false);
  const [datos, setDatos] = useState({
    nombre: actual?.protocolo.nombre ?? "Protocolo",
    fecha_inicio: actual?.protocolo.fecha_inicio ?? "",
    fuera: (actual?.protocolo.fuera_protocolo ?? []).join("\n"),
    fases: (actual?.protocolo.fases ?? []) as FaseProtocolo[]
  });
  const fasesGuardadas = actual?.protocolo.fases ?? [];
  const [fasePrevia, setFasePrevia] = useState(1);

  function correr(fn: () => Promise<{ error?: string }>, ok?: string, despues?: () => void) {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else {
        if (ok) setAviso(ok);
        despues?.();
      }
    });
  }

  function abrir(id: string | "nuevo", base: ItemEntrada) {
    setEditando(id);
    setForm(base);
    setSegmentoLibre(!SEGMENTOS.includes(base.segmento));
  }

  const segmentos = [...new Set([...SEGMENTOS, ...items.map((i) => i.segmento)])];
  const grupos = segmentos
    .map((s) => ({ segmento: s, lista: items.filter((i) => i.segmento === s).sort((a, b) => a.orden - b.orden) }))
    .filter((g) => g.lista.length);

  // Vista previa: cómo queda ordenado en un día de entreno y uno de
  // descanso (con las horas del menú de cada tipo de día y, si hay fases,
  // en la fase elegida)
  const previa = (entreno: boolean) => {
    const horario = horarioDelDia(cn, horarios?.[entreno ? "entreno" : "descanso"] ?? {}, 60);
    const fase = fasesGuardadas.length ? Math.min(fasePrevia, fasesGuardadas.length) : null;
    return items
      .filter((i) => i.aplica === "todos" || (i.aplica === "entreno") === entreno)
      .filter((i) => aplicaHoy({ ...i, dias: [], semana_desde: null, semana_hasta: null }, 1, entreno, 1, fase))
      .map((i) => ({ i, h: horaDelItem(i, horario, 60) }))
      .sort((a, b) => (a.h?.min ?? 9999) - (b.h?.min ?? 9999));
  };

  const set = <K extends keyof ItemEntrada>(k: K, v: ItemEntrada[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-col gap-3">
      <section className={`card ${borrador ? "border-warn/50" : ""}`}>
        {borrador ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-warn">Cambios sin enviar</p>
            <p className="mt-1 text-sm text-muted">
              {publicado
                ? "El cliente sigue viendo la versión anterior hasta que envíes esta."
                : "El cliente todavía no ve el protocolo."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pendiente}
                onClick={() => correr(() => enviarProtocolo({ userId }), "✓ Enviado: ya aparece en su checklist de Hoy.")}
                className="btn-primary"
              >
                Enviar al cliente
              </button>
              <button
                type="button"
                disabled={pendiente}
                onClick={() => {
                  if (window.confirm(publicado ? "¿Descartar los cambios y volver a la versión que ve el cliente?" : "¿Descartar este protocolo?"))
                    correr(() => descartarCambiosProtocolo({ userId }));
                }}
                className="btn-ghost"
              >
                Descartar cambios
              </button>
            </div>
          </>
        ) : publicado ? (
          <>
            <p className="font-semibold">✓ Publicado</p>
            <p className="mt-1 text-sm text-muted">
              El cliente lo ve en su checklist de Hoy desde el{" "}
              {new Date(`${publicado.inicio}T12:00:00`).toLocaleDateString("es-MX")}. Si lo editas, se guarda como
              borrador hasta que lo vuelvas a enviar.
            </p>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => {
                if (window.confirm("¿Quitarle el protocolo al cliente? Deja de verlo en Hoy."))
                  correr(() => quitarProtocoloCliente({ userId }));
              }}
              className="mt-2 text-xs font-semibold text-danger"
            >
              Quitar protocolo
            </button>
          </>
        ) : (
          <>
            <p className="font-semibold">Sin protocolo</p>
            <p className="mt-1 text-sm text-muted">
              Suplementos, hábitos, cara, cabello, sueño… Agrega cada cosa con su momento del día y la app la
              ordena en el checklist del cliente según sus horarios.
            </p>
          </>
        )}
        <p className="mt-3 text-xs text-muted">
          La app solo ordena por horario lo que tú indicas: no recomienda suplementos ni productos.
        </p>
      </section>

      {grupos.map((g) => (
        <section key={g.segmento} className="card">
          <h2 className="font-bold">{g.segmento}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {g.lista.map((it, n) => (
              <li key={it.id} className="rounded-xl border border-line px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{it.titulo}</p>
                    {it.detalle ? <p className="text-sm text-muted">{it.detalle}</p> : null}
                    <p className="mt-0.5 text-xs text-accent">
                      {textoCuando(it)} · {textoCuandoAplica(it)}
                    </p>
                    {it.porque ? <p className="mt-0.5 text-xs italic text-muted">Por qué: {it.porque}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-1 text-sm">
                    <button type="button" aria-label="Subir" disabled={pendiente || n === 0} onClick={() => correr(() => moverItemProtocolo({ userId, itemId: it.id, direccion: -1 }))} className="px-1.5 text-muted disabled:opacity-30">↑</button>
                    <button type="button" aria-label="Bajar" disabled={pendiente || n === g.lista.length - 1} onClick={() => correr(() => moverItemProtocolo({ userId, itemId: it.id, direccion: 1 }))} className="px-1.5 text-muted disabled:opacity-30">↓</button>
                    <button type="button" disabled={pendiente} onClick={() => abrir(it.id, desdeItem(it))} className="px-1.5 font-semibold text-accent">Editar</button>
                    <button
                      type="button"
                      aria-label="Borrar"
                      disabled={pendiente}
                      onClick={() => {
                        if (window.confirm(`¿Borrar "${it.titulo}"?`)) correr(() => borrarItemProtocolo({ userId, itemId: it.id }));
                      }}
                      className="px-1.5 text-danger"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editando ? (
        <section className="card border-accent/60">
          <h2 className="font-bold">{editando === "nuevo" ? "Nuevo ítem" : "Editar ítem"}</h2>
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <label className="label" htmlFor="p-seg">Segmento</label>
              {segmentoLibre ? (
                <div className="flex gap-2">
                  <input id="p-seg" className="input" value={form.segmento} maxLength={40} onChange={(e) => set("segmento", e.target.value)} placeholder="Ej. Postura, Meditación" />
                  <button type="button" className="btn-ghost shrink-0 px-3" onClick={() => { setSegmentoLibre(false); set("segmento", SEGMENTOS[0]); }}>Lista</button>
                </div>
              ) : (
                <select
                  id="p-seg"
                  className="input"
                  value={form.segmento}
                  onChange={(e) => {
                    if (e.target.value === "__otro") {
                      setSegmentoLibre(true);
                      set("segmento", "");
                    } else set("segmento", e.target.value);
                  }}
                >
                  {segmentos.map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value="__otro">Otro…</option>
                </select>
              )}
            </div>
            <div>
              <label className="label" htmlFor="p-tit">Qué</label>
              <input id="p-tit" className="input" value={form.titulo} maxLength={120} onChange={(e) => set("titulo", e.target.value)} placeholder="Ej. Creatina 5 g" />
            </div>
            <div>
              <label className="label" htmlFor="p-det">Detalle (cantidad o cómo)</label>
              <input id="p-det" className="input" value={form.detalle} maxLength={300} onChange={(e) => set("detalle", e.target.value)} placeholder="Ej. Con el agua de la mañana" />
            </div>
            <div>
              <label className="label" htmlFor="p-por">Por qué (opcional)</label>
              <input id="p-por" className="input" value={form.porque ?? ""} maxLength={300} onChange={(e) => set("porque", e.target.value || null)} placeholder="Una frase: lo que cuesta se sostiene si se entiende" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="p-cuando">Cuándo</label>
                <select id="p-cuando" className="input" value={form.ancla} onChange={(e) => set("ancla", e.target.value as ItemEntrada["ancla"])}>
                  {ANCLAS.map((a) => <option key={a.valor} value={a.valor}>{a.texto}</option>)}
                </select>
              </div>
              {form.ancla === "hora_fija" ? (
                <div>
                  <label className="label" htmlFor="p-hora">Hora</label>
                  <input id="p-hora" type="time" className="input" value={form.hora ?? ""} onChange={(e) => set("hora", e.target.value || null)} />
                </div>
              ) : form.ancla !== "en_el_dia" ? (
                <div>
                  <label className="label" htmlFor="p-off">Minutos (+/−)</label>
                  <input id="p-off" type="number" inputMode="numeric" className="input" value={form.offset_min || ""} min={-240} max={240} step={5} onChange={(e) => set("offset_min", Number(e.target.value) || 0)} placeholder="0" />
                </div>
              ) : null}
            </div>
            <div>
              <p className="label">Días</p>
              <div className="flex gap-1.5">
                {DIAS.map((d, i) => {
                  const on = form.dias.includes(i + 1);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          dias: f.dias.includes(i + 1) ? f.dias.filter((x) => x !== i + 1) : [...f.dias, i + 1]
                        }))
                      }
                      className={`h-9 w-9 rounded-full border text-sm font-semibold ${on ? "border-accent text-accent" : "border-line text-muted"}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3 sm:col-span-1">
                <label className="label" htmlFor="p-apl">Aplica</label>
                <select id="p-apl" className="input" value={form.aplica} onChange={(e) => set("aplica", e.target.value as ItemEntrada["aplica"])}>
                  <option value="todos">Todos los días</option>
                  <option value="entreno">Solo días de entreno</option>
                  <option value="descanso">Solo días de descanso</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="p-sd">Desde sem.</label>
                <input id="p-sd" type="number" inputMode="numeric" min={1} max={52} className="input" value={form.semana_desde ?? ""} onChange={(e) => set("semana_desde", e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label className="label" htmlFor="p-sh">Hasta sem.</label>
                <input id="p-sh" type="number" inputMode="numeric" min={1} max={52} className="input" value={form.semana_hasta ?? ""} onChange={(e) => set("semana_hasta", e.target.value ? Number(e.target.value) : null)} />
              </div>
            </div>
            <p className="text-xs text-muted">
              Las semanas sirven para progresiones (ej. retinol 2 noches en las semanas 1-2, 3 noches desde la 3).
            </p>
            {fasesGuardadas.length > 1 ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="p-fd">Desde la fase</label>
                  <select
                    id="p-fd"
                    className="input"
                    value={form.fase_desde ?? 1}
                    onChange={(e) => set("fase_desde", Number(e.target.value) === 1 ? null : Number(e.target.value))}
                  >
                    {fasesGuardadas.map((f, i) => (
                      <option key={i} value={i + 1}>{f.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="p-fh">Hasta la fase</label>
                  <select
                    id="p-fh"
                    className="input"
                    value={form.fase_hasta ?? 0}
                    onChange={(e) => set("fase_hasta", Number(e.target.value) || null)}
                  >
                    <option value={0}>Hasta el final</option>
                    {fasesGuardadas.map((f, i) => (
                      <option key={i} value={i + 1}>{f.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pendiente || !form.titulo.trim()}
                onClick={() =>
                  correr(
                    () => guardarItemProtocolo({ userId, itemId: editando === "nuevo" ? null : editando, item: form }),
                    undefined,
                    () => setEditando(null)
                  )
                }
                className="btn-primary flex-1"
              >
                {pendiente ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" onClick={() => setEditando(null)} className="btn-ghost">Cancelar</button>
            </div>
          </div>
        </section>
      ) : (
        <button type="button" onClick={() => abrir("nuevo", NUEVO)} className="btn-ghost w-full">
          + Agregar ítem
        </button>
      )}

      {items.length ? (
        <section className="card">
          <h2 className="font-bold">Así lo ve ordenado</h2>
          <p className="text-xs text-muted">
            Con los horarios del menú y del cliente (lo que no tiene hora va al final; ~ = hora estimada).
          </p>
          {fasesGuardadas.length > 1 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fasesGuardadas.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFasePrevia(i + 1)}
                  className={`chip px-2.5 py-1 text-xs ${fasePrevia === i + 1 ? "border-accent text-accent" : "border-line text-muted"}`}
                >
                  {f.nombre}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {[true, false].map((entreno) => (
              <div key={String(entreno)}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  Día de {entreno ? "entreno" : "descanso"}
                </p>
                <ul className="flex flex-col gap-1 text-sm">
                  {previa(entreno).map(({ i, h }) => (
                    <li key={i.id} className="flex gap-2">
                      <span className="w-16 shrink-0 text-xs text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {h ? `${h.real ? "" : "~"}${fmtHora(aHora(h.min))}` : "en el día"}
                      </span>
                      <span className="min-w-0 truncate">{i.titulo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 className="font-bold">Datos del protocolo</h2>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="p-nom">Nombre</label>
            <input id="p-nom" className="input" value={datos.nombre} maxLength={80} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="p-ini">Fecha de inicio (día 1: fase 1 y semana 1)</label>
            <input id="p-ini" type="date" className="input" value={datos.fecha_inicio} onChange={(e) => setDatos({ ...datos, fecha_inicio: e.target.value })} />
            <p className="mt-1 text-xs text-muted">Si lo dejas vacío, arranca el día que lo envías.</p>
          </div>
          <div>
            <p className="label">Fases</p>
            <p className="text-xs text-muted">
              Para planes que suman cosas por etapas (ej. Fase 1 días 1-7, Fase 2 días 8-14, Fase 3 desde el 15). La
              app le muestra al cliente en qué fase va, le avisa la víspera de cada cambio y solo le pone lo de su fase.
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {datos.fases.map((f, i) => (
                <li key={i} className="rounded-xl border border-line p-2">
                  <div className="flex gap-2">
                    <input
                      className="input flex-1 py-1.5 text-sm"
                      value={f.nombre}
                      maxLength={60}
                      aria-label={`Nombre de la fase ${i + 1}`}
                      onChange={(e) =>
                        setDatos((d) => ({ ...d, fases: d.fases.map((x, k) => (k === i ? { ...x, nombre: e.target.value } : x)) }))
                      }
                    />
                    <label className="flex items-center gap-1 text-xs text-muted">
                      desde el día
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        className="input w-16 px-2 py-1.5 text-sm"
                        value={f.desde_dia}
                        disabled={i === 0}
                        onChange={(e) =>
                          setDatos((d) => ({
                            ...d,
                            fases: d.fases.map((x, k) => (k === i ? { ...x, desde_dia: Number(e.target.value) || 1 } : x))
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={`Quitar la fase ${i + 1}`}
                      onClick={() => setDatos((d) => ({ ...d, fases: d.fases.filter((_, k) => k !== i) }))}
                      className="px-1 text-danger"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    className="input mt-1.5 py-1.5 text-sm"
                    value={f.nota ?? ""}
                    maxLength={300}
                    placeholder="Qué se hace en esta fase (lo ve el cliente)"
                    aria-label={`Nota de la fase ${i + 1}`}
                    onChange={(e) =>
                      setDatos((d) => ({ ...d, fases: d.fases.map((x, k) => (k === i ? { ...x, nota: e.target.value || null } : x)) }))
                    }
                  />
                  {datos.fases.length > 1 ? (
                    <p className="mt-1 text-[11px] text-muted">{textoDiasFase(datos.fases, i)}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                setDatos((d) => {
                  const ultima = d.fases[d.fases.length - 1];
                  const nueva = { nombre: `Fase ${d.fases.length + 1}`, desde_dia: ultima ? ultima.desde_dia + 7 : 1, nota: null };
                  // La primera fase que se agrega trae la 2: una sola fase no es un plan por fases
                  return { ...d, fases: d.fases.length ? [...d.fases, nueva] : [nueva, { nombre: "Fase 2", desde_dia: 8, nota: null }] };
                })
              }
              className="btn-ghost mt-2 w-full py-1.5 text-sm"
            >
              + Agregar fase
            </button>
            {datos.fases.length > 1 ? (
              <p className="mt-1 text-xs text-muted">
                Guarda los datos y después, en cada ítem, elige desde qué fase se usa.
              </p>
            ) : null}
          </div>
          <div>
            <label className="label" htmlFor="p-fuera">Fuera del protocolo (una línea por cosa)</label>
            <textarea
              id="p-fuera"
              rows={3}
              className="input"
              value={datos.fuera}
              onChange={(e) => setDatos({ ...datos, fuera: e.target.value })}
              placeholder="Ej. Dermaroller — irrita y compite con el retinol"
            />
            <p className="mt-1 text-xs text-muted">Lo que NO hace falta comprar y por qué. Genera confianza y le ahorra dinero.</p>
          </div>
          <button
            type="button"
            onClick={() => correr(() => guardarDatosProtocolo({ userId, ...datos }), "✓ Guardado en el borrador.")}
            disabled={pendiente || datos.fases.length === 1}
            className="btn-ghost"
          >
            Guardar datos
          </button>
        </div>
      </section>

      {aviso ? <p className="text-sm font-medium text-ok">{aviso}</p> : null}
      {error ? <p className="text-sm font-medium text-danger">✗ {error}</p> : null}
    </div>
  );
}
