"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { marcarComida } from "@/app/actions/comidas";
import { marcarItemHoy } from "@/app/actions/hoy";
import ConstanciaTira from "@/components/ConstanciaTira";
import { fmtHora, porcentaje, siguientePendiente, type ItemHoy } from "@/lib/hoy";
import type { ChecklistHoy as Datos } from "@/lib/hoy-db";

const FRANJAS = [
  { hasta: 12 * 60, nombre: "Mañana" },
  { hasta: 18 * 60, nombre: "Tarde" },
  { hasta: 24 * 60, nombre: "Noche" },
  { hasta: Infinity, nombre: "En el día" }
];

const ICONO: Record<ItemHoy["tipo"], string> = { comida: "🍽️", entreno: "🏋️", agua: "💧", protocolo: "•" };

// "Hoy": todo lo que toca en el día, en orden de hora, con casillas. Las
// comidas del menú se registran al marcarlas; el entreno se completa
// registrando series; el agua y el protocolo son casillas simples.
export default function ChecklistHoy({
  datos,
  ahoraMin,
  diaNombre,
  resumenComida,
  soloLectura = false
}: {
  datos: Datos;
  ahoraMin: number;
  diaNombre: string;
  resumenComida?: string | null;
  soloLectura?: boolean; // la ficha del entrenador
}) {
  const [items, setItems] = useState(datos.items);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setItems(datos.items), [datos.items]);

  const pct = porcentaje(items);
  const hechos = items.filter((i) => i.hecho).length;
  const ahora = soloLectura ? null : siguientePendiente(items, ahoraMin);

  function marcar(it: ItemHoy) {
    const nuevo = !it.hecho;
    setError(null);
    setItems((xs) => xs.map((x) => (x.key === it.key ? { ...x, hecho: nuevo, soloManual: false } : x)));
    iniciar(async () => {
      let r: { error?: string };
      try {
        r =
          it.tipo === "comida" && it.momento
            ? await marcarComida({ fecha: datos.fecha, tipo_dia: datos.tipoDia, momento: it.momento, hecha: nuevo })
            : await marcarItemHoy({ fecha: datos.fecha, key: it.key, hecho: nuevo });
      } catch {
        r = { error: "Sin conexión: márcalo cuando vuelva la señal." };
      }
      if (r.error) {
        setError(r.error);
        setItems((xs) => xs.map((x) => (x.key === it.key ? { ...x, hecho: it.hecho, soloManual: it.soloManual } : x)));
      }
    });
  }

  const grupos = FRANJAS.map((f, i) => ({
    nombre: f.nombre,
    lista: items.filter((it) => it.orden < f.hasta && it.orden >= (i ? FRANJAS[i - 1].hasta : 0))
  })).filter((g) => g.lista.length);

  return (
    <section className="card mb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {diaNombre} · {datos.tipoDia === "entreno" ? "día de entreno" : "día de descanso"}
          </p>
          <p className="text-3xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {pct ?? 0} %
          </p>
          <p className="text-xs text-muted">
            {hechos} de {items.length} hecho{items.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {datos.racha}
          </p>
          <p className="text-xs text-muted">
            {datos.racha === 1 ? "día seguido" : "días seguidos"}
            <br />
            con 70 % o más
          </p>
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-all ${(pct ?? 0) >= 70 ? "bg-ok" : "bg-accent"}`}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>

      <div className="mt-3">
        <ConstanciaTira tira={datos.tira} promedio={datos.promedio14} />
      </div>

      <FaseActual datos={datos} />

      {resumenComida ? (
        <Link href="/nutricion" className="mt-3 block rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">
          {resumenComida} <span className="font-semibold text-accent">· Nutrición →</span>
        </Link>
      ) : null}

      {!items.length ? (
        <p className="mt-4 text-center text-sm text-muted">Hoy no hay nada en tu plan.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {grupos.map((g) => (
            <div key={g.nombre}>
              <div className="mb-1.5 flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{g.nombre}</h3>
                <span className="h-px flex-1 bg-line" />
              </div>
              <ul className="flex flex-col gap-1.5">
                {g.lista.map((it) => {
                  const esAhora = ahora?.key === it.key;
                  const marcable =
                    !soloLectura &&
                    (it.tipo === "agua" || it.tipo === "protocolo" || (it.tipo === "comida" && it.conMenu && !it.soloManual));
                  const caja = (
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                        it.hecho ? "border-ok bg-ok text-accent-ink" : "border-line"
                      }`}
                    >
                      {it.hecho ? "✓" : ""}
                    </span>
                  );
                  const texto = (
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[15px] font-semibold leading-snug ${it.hecho ? "text-muted line-through decoration-1" : ""}`}>
                        {it.tipo === "protocolo" ? null : <span className="mr-1">{ICONO[it.tipo]}</span>}
                        {it.titulo}
                      </span>
                      {it.detalle ? <span className="block text-xs text-muted">{it.detalle}</span> : null}
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {it.segmento ? (
                          <span className="chip border-line px-2 py-0 text-[11px] text-muted">{it.segmento}</span>
                        ) : null}
                        {it.soloManual ? <span className="text-[11px] text-ok">registrada en Nutrición</span> : null}
                        {esAhora ? <span className="chip border-accent px-2 py-0 text-[11px] text-accent">Ahora</span> : null}
                      </span>
                    </span>
                  );
                  const hora = (
                    <span
                      className="w-[3.4rem] shrink-0 pt-1 text-[11px] font-semibold text-muted"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {it.hora ? fmtHora(it.hora) : ""}
                    </span>
                  );
                  const clase = `flex w-full items-start gap-2 rounded-xl border px-2 py-2 text-left ${
                    esAhora ? "border-accent" : "border-transparent"
                  }`;
                  const fondo = esAhora ? { background: "color-mix(in srgb, var(--accent) 10%, transparent)" } : undefined;
                  return (
                    <li key={it.key}>
                      {marcable ? (
                        <button type="button" onClick={() => marcar(it)} disabled={pendiente} className={clase} style={fondo}>
                          {hora}
                          {caja}
                          {texto}
                        </button>
                      ) : it.href && !soloLectura ? (
                        <Link href={it.href} className={clase} style={fondo}>
                          {hora}
                          {caja}
                          {texto}
                          {it.tipo === "entreno" && !it.hecho ? (
                            <span className="shrink-0 self-center text-xs font-semibold text-accent">Empezar →</span>
                          ) : null}
                        </Link>
                      ) : (
                        <div className={clase} style={fondo}>
                          {hora}
                          {caja}
                          {texto}
                        </div>
                      )}
                      {it.porque ? (
                        <div className="pl-[5.4rem]">
                          <button
                            type="button"
                            onClick={() => setAbierto(abierto === it.key ? null : it.key)}
                            className="text-[11px] font-semibold text-accent"
                          >
                            {abierto === it.key ? "Ocultar" : "¿Por qué?"}
                          </button>
                          {abierto === it.key ? <p className="text-xs text-muted">{it.porque}</p> : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      {datos.conProtocolo && !soloLectura ? (
        <Link href="/protocolo" className="mt-3 block text-center text-xs font-semibold text-accent">
          Ver tu protocolo completo →
        </Link>
      ) : null}
      {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
    </section>
  );
}

// "martes 12 de octubre"
function fechaLarga(f: string): string {
  return new Date(`${f}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((new Date(`${hasta}T12:00:00Z`).getTime() - new Date(`${desde}T12:00:00Z`).getTime()) / 86_400_000);
}

// En qué fase del protocolo va, lo que se sumó y lo que viene
function FaseActual({ datos }: { datos: Datos }) {
  const f = datos.fase;
  if (datos.protocoloEmpieza) {
    return (
      <p className="mt-3 rounded-xl border border-line px-3 py-2 text-xs text-muted">
        Tu protocolo empieza el <span className="font-semibold text-ink">{fechaLarga(datos.protocoloEmpieza)}</span>
        {f ? ` con la ${f.nombre}` : ""}. Hasta entonces, sigue con tu menú y tu rutina.
      </p>
    );
  }
  if (!f) return null;
  const faltan = f.proxima ? diasEntre(datos.fecha, f.proxima.fecha) : null;
  return (
    <div className="mt-3 rounded-xl border border-line px-3 py-2">
      <p className="text-sm font-semibold">
        {f.nombre}{" "}
        <span className="font-normal text-muted">
          · {f.numero} de {f.total} · día {f.diaDeLaFase}
          {f.hasta ? ` de ${diasEntre(datos.fecha, f.hasta) + f.diaDeLaFase}` : ""}
        </span>
      </p>
      {f.nota ? <p className="text-xs text-muted">{f.nota}</p> : null}
      {f.numero > 1 && f.diaDeLaFase <= 3 && f.nuevos.length ? (
        <p className="mt-1 text-xs font-medium text-accent">Nuevo en esta fase: {f.nuevos.join(", ")}</p>
      ) : null}
      {f.proxima && faltan != null && faltan <= 3 ? (
        <p className="mt-1 text-xs">
          {faltan <= 1 ? "Mañana" : `El ${fechaLarga(f.proxima.fecha)}`} empieza la {f.proxima.nombre}
          {f.proxima.nuevos.length ? `: se suma ${f.proxima.nuevos.join(", ")}` : ""}. Revisa que lo tengas.
        </p>
      ) : null}
    </div>
  );
}
