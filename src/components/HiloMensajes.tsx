"use client";

import { useEffect, useState, useTransition } from "react";
import { borradorMensaje, enviarMensaje, marcarLeidos } from "@/app/actions/mensajes";
import type { Mensaje } from "@/lib/types";

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

// Hilo entrenador ↔ cliente. `soyEntrenador` habilita los borradores con
// IA (abandono / aliento) y manda push al cliente al enviar.
export default function HiloMensajes({
  userId,
  soyEntrenador,
  inicial,
  conIA = false,
  nombreCliente = ""
}: {
  userId?: string; // el cliente del hilo (solo lo pasa el entrenador)
  soyEntrenador: boolean;
  inicial: Mensaje[];
  conIA?: boolean;
  nombreCliente?: string;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([...inicial].reverse());
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  // Al abrir el hilo, lo del otro lado queda leído
  useEffect(() => {
    if (mensajes.some((m) => m.de !== (soyEntrenador ? "entrenador" : "cliente") && !m.leido_at)) {
      void marcarLeidos({ userId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enviar() {
    if (texto.trim().length < 2) return;
    setError(null);
    iniciar(async () => {
      const r = await enviarMensaje({ userId, texto });
      if (r.error || !r.mensaje) setError(r.error ?? "No se pudo enviar.");
      else {
        setMensajes((l) => [...l, r.mensaje!]);
        setTexto("");
      }
    });
  }

  function borrador(motivo: "abandono" | "aliento" | "libre") {
    if (!userId) return;
    setError(null);
    iniciar(async () => {
      const r = await borradorMensaje({ userId, motivo });
      if (r.error || !r.texto) setError(r.error ?? "No se pudo generar el borrador.");
      else setTexto(r.texto);
    });
  }

  const mios = soyEntrenador ? "entrenador" : "cliente";

  return (
    <section className="card">
      <h2 className="font-bold">{soyEntrenador ? `Mensajes con ${nombreCliente || "el cliente"}` : "Mensajes con tu entrenador"}</h2>
      <ul className="mt-3 flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
        {mensajes.length === 0 ? (
          <li className="text-center text-sm text-muted">
            {soyEntrenador ? "Todavía no le escribiste. Un mensaje a tiempo vale más que cualquier función." : "Acá van a aparecer los mensajes de tu entrenador."}
          </li>
        ) : null}
        {mensajes.map((m) => (
          <li
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              m.de === mios ? "self-end bg-accent/20" : "self-start border border-line bg-surface2"
            }`}
          >
            <p className="whitespace-pre-line">{m.texto}</p>
            <p className="mt-1 text-right text-[11px] text-muted">
              {fmt(m.created_at)}
              {m.de === mios && m.leido_at ? " · leído" : ""}
            </p>
          </li>
        ))}
      </ul>

      {soyEntrenador && conIA ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => borrador("abandono")} disabled={pendiente} className="chip border-line text-muted">
            ✍️ Borrador: recuperarlo
          </button>
          <button type="button" onClick={() => borrador("aliento")} disabled={pendiente} className="chip border-line text-muted">
            ✍️ Borrador: aliento
          </button>
          <button type="button" onClick={() => borrador("libre")} disabled={pendiente} className="chip border-line text-muted">
            ✍️ Borrador: seguimiento
          </button>
        </div>
      ) : null}
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        className="input mt-2"
        placeholder={soyEntrenador ? "Escríbele al cliente…" : "Escríbele a tu entrenador…"}
      />
      <button type="button" onClick={enviar} disabled={pendiente || texto.trim().length < 2} className="btn-primary mt-2 w-full">
        {pendiente ? "…" : "Enviar"}
      </button>
      {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
    </section>
  );
}
