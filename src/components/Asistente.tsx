"use client";

import { useState, useTransition } from "react";
import { aplicarAjuste, consultarAsistente } from "@/app/actions/asistente";
import { DESCARGO_CORTO } from "@/lib/descargo";
import { nombreMomento } from "@/lib/nutrition";
import type { AsistenteLog } from "@/lib/types";

const ATAJOS = [
  { texto: "🎉 Tengo una fiesta", pregunta: "Hoy tengo una fiesta a la noche y va a haber " },
  { texto: "🍽️ Estoy en un restaurante", pregunta: "Estoy en un restaurante de " },
  { texto: "🥫 No tengo un ingrediente", pregunta: "No tengo " },
  { texto: "🍫 Quiero algo dulce", pregunta: "Tengo ganas de algo dulce, ¿qué puedo comer?" },
  { texto: "✈️ Estoy de viaje", pregunta: "Estoy de viaje y no puedo cocinar; " },
  { texto: "😅 Ayer me pasé", pregunta: "Ayer comí de más, ¿qué hago hoy?" }
];

const ETIQUETA_TIPO: Record<AsistenteLog["tipo"], string> = {
  evento: "Evento",
  restaurante: "Restaurante",
  falta_ingrediente: "Reemplazo",
  antojo: "Antojo",
  viaje: "Viaje",
  me_pase: "Volver al plan",
  otro: "Consulta"
};

// "Hoy tengo un cumpleaños con asado y torta": la IA responde con qué
// comer, cuánto y cómo acomodar el resto del día, con el contexto real
// del día del cliente. La respuesta se puede fijar como ajuste de hoy.
export default function Asistente({
  userId,
  fecha,
  conIA,
  historial
}: {
  userId?: string;
  fecha: string;
  conIA: boolean;
  historial: AsistenteLog[];
}) {
  const [abierto, setAbierto] = useState(historial.length > 0);
  const [pregunta, setPregunta] = useState("");
  const [logs, setLogs] = useState<AsistenteLog[]>(historial);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (!conIA) return null;

  function consultar() {
    if (pregunta.trim().length < 5) return;
    setError(null);
    iniciar(async () => {
      const r = await consultarAsistente({ userId, fecha, pregunta });
      if (r.error || !r.log) setError(r.error ?? "No se pudo consultar.");
      else {
        setLogs((l) => [r.log!, ...l]);
        setPregunta("");
      }
    });
  }

  function fijar(log: AsistenteLog) {
    setError(null);
    iniciar(async () => {
      const r = await aplicarAjuste({ logId: log.id, aplicado: !log.aplicado });
      if (r.error) setError(r.error);
      else setLogs((l) => l.map((x) => ({ ...x, aplicado: x.id === log.id ? !log.aplicado : false })));
    });
  }

  return (
    <section className="card">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h2 className="font-bold">💬 ¿Hoy pasa algo distinto?</h2>
          <p className="text-xs text-muted">Fiesta, restaurante, viaje, antojo, te falta algo… te digo cómo resolverlo.</p>
        </div>
        <span className="text-muted">{abierto ? "▾" : "▸"}</span>
      </button>

      {abierto ? (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5">
            {ATAJOS.map((a) => (
              <button
                key={a.texto}
                type="button"
                onClick={() => setPregunta(a.pregunta)}
                className="chip border-line text-muted"
              >
                {a.texto}
              </button>
            ))}
          </div>
          <textarea
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            rows={3}
            className="input mt-2"
            placeholder="Ej: hoy tengo un cumpleaños, va a haber asado, pizza y torta"
          />
          <button
            type="button"
            onClick={consultar}
            disabled={pendiente || pregunta.trim().length < 5}
            className="btn-primary mt-2 w-full"
          >
            {pendiente ? "Pensando…" : "Preguntar"}
          </button>
          {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}

          {logs.length ? (
            <ul className="mt-3 flex flex-col gap-3">
              {logs.slice(0, 3).map((log) => (
                <li key={log.id} className={`rounded-xl border p-3 ${log.aplicado ? "border-accent/60" : "border-line"}`}>
                  <p className="text-xs text-muted">
                    <span className="chip mr-1.5 border-line px-2 py-0 text-[11px]">{ETIQUETA_TIPO[log.tipo]}</span>
                    &ldquo;{log.pregunta}&rdquo;
                  </p>
                  <p className="mt-2 font-semibold">{log.respuesta.resumen}</p>
                  {log.respuesta.que_comer.length ? (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {log.respuesta.que_comer.map((q, i) => (
                        <li key={i} className="rounded-lg bg-surface2 px-2.5 py-1.5 text-sm">
                          <span className="font-semibold">{q.opcion}</span>
                          {q.cantidad ? <span className="text-accent"> · {q.cantidad}</span> : null}
                          {q.por_que ? <span className="block text-xs text-muted">{q.por_que}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {log.respuesta.reacomodo_dia.length ? (
                    <div className="mt-2 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">El resto del día</p>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {log.respuesta.reacomodo_dia.map((r, i) => (
                          <li key={i}>
                            <span className="text-muted">{r.momento === "general" ? "En general" : nombreMomento(r.momento)}:</span>{" "}
                            {r.cambio}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {log.respuesta.mensaje ? <p className="mt-2 text-sm text-muted">{log.respuesta.mensaje}</p> : null}
                  <button
                    type="button"
                    onClick={() => fijar(log)}
                    disabled={pendiente}
                    className={`chip mt-2 min-h-[36px] px-3 ${log.aplicado ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"}`}
                  >
                    {log.aplicado ? "✓ Es mi ajuste de hoy" : "Usar como ajuste de hoy"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-xs text-muted">{DESCARGO_CORTO}</p>
        </div>
      ) : null}
    </section>
  );
}
