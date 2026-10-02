"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aplicarProtocoloTxtAction, interpretarProtocoloTxtAction } from "@/app/actions/protocolo";
import type { ProtocoloInterpretado } from "@/lib/ai-protocolo";
import { fmtHora } from "@/lib/hoy";
import { nombreMomento } from "@/lib/nutrition";
import { textoCuando, textoCuandoAplica, textoDiasFase } from "@/lib/protocolo";

// Hoy en la zona del navegador ("2026-10-05")
function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Importar el plan escrito por el entrenador (el mismo texto que le daría
// al cliente): la IA saca suplementos, hábitos y cuidados con su momento
// del día, y los horarios que fija el texto. Vista previa → borrador.
export default function ProtocoloTxt({
  userId,
  conIA,
  tieneMenuCliente
}: {
  userId: string;
  conIA: boolean;
  tieneMenuCliente: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [preview, setPreview] = useState<ProtocoloInterpretado | null>(null);
  const [usarHorarios, setUsarHorarios] = useState(true);
  const [inicio, setInicio] = useState(hoyLocal);
  const [guardada, setGuardada] = useState(false);
  const [guardado, setGuardado] = useState<{ conComidas: boolean } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function leerArchivo(f: File | undefined) {
    if (!f) return;
    if (f.size > 200_000) return setError("El archivo es muy grande (máx. 200 KB).");
    setTexto(await f.text());
  }

  function interpretar(releer = false) {
    setError(null);
    setGuardado(null);
    iniciar(async () => {
      const r = await interpretarProtocoloTxtAction({ userId, texto, releer });
      if (r.error || !r.resultado) return setError(r.error ?? "No se pudo interpretar.");
      setPreview(r.resultado);
      setGuardada(!!r.lecturaGuardada);
      const h = r.resultado.horarios;
      setUsarHorarios(!!(h.despertar || h.entreno || h.dormir || h.comidas.length));
    });
  }

  function guardar() {
    if (!preview) return;
    setError(null);
    iniciar(async () => {
      const r = await aplicarProtocoloTxtAction({
        userId,
        nombre: preview.nombre,
        items: preview.items,
        fuera: preview.fuera_protocolo,
        fases: preview.fases,
        fecha_inicio: inicio || null,
        horarios: usarHorarios ? preview.horarios : null
      });
      if (r.error) return setError(r.error);
      setGuardado({ conComidas: preview.tiene_comidas });
      setPreview(null);
    });
  }

  function pasarAlMenu() {
    try {
      sessionStorage.setItem(`plan-txt:${userId}`, texto);
    } catch {}
    router.push(`/entrenador/${userId}?tab=nutricion&desde=protocolo`);
  }

  if (!abierto && !guardado) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="btn-ghost w-full">
        📄 Importar desde el texto de tu plan
      </button>
    );
  }

  const h = preview?.horarios;
  const hayHorarios = !!h && !!(h.despertar || h.entreno || h.dormir || h.comidas.length);
  const segmentos = preview ? [...new Set(preview.items.map((i) => i.segmento))] : [];

  return (
    <section className="card border-accent/60">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">Importar desde tu plan</h2>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setPreview(null);
            setGuardado(null);
          }}
          className="text-xs font-semibold text-muted"
        >
          Cerrar
        </button>
      </div>

      {guardado ? (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-sm font-medium text-ok">
            ✓ Guardado como borrador. Revísalo abajo y cuando esté bien, envíalo.
          </p>
          {guardado.conComidas ? (
            <div className="rounded-xl border border-line p-3">
              <p className="text-sm font-semibold">Tu texto también trae comidas</p>
              <p className="mt-1 text-xs text-muted">
                Pásalas al menú: se interpreta el mismo texto en la pestaña Comida
                {tieneMenuCliente ? " (reemplaza la recomendación actual cuando la guardes)" : ""}.
              </p>
              <button type="button" onClick={pasarAlMenu} className="btn-primary mt-2 w-full">
                Pasar las comidas al menú →
              </button>
            </div>
          ) : null}
        </div>
      ) : !preview ? (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-sm text-muted">
            Pega el plan tal como se lo darías al cliente (horarios, suplementos, cara, cabello, hábitos). La IA
            ubica cada cosa en su momento del día. No agrega ni recomienda nada: solo ordena lo que tú escribiste.
          </p>
          <label className="btn-ghost w-fit cursor-pointer px-3 py-1.5 text-sm">
            Cargar .txt
            <input
              type="file"
              accept=".txt,text/plain,.md"
              className="hidden"
              onChange={(e) => leerArchivo(e.target.files?.[0])}
            />
          </label>
          <textarea
            rows={8}
            className="input font-mono text-sm"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={"5:30 AM Despertar: agua con limón, 5 g de creatina\n6:00 AM Entreno: 1 scoop de aminoácidos\n…"}
          />
          <button
            type="button"
            onClick={() => interpretar()}
            disabled={pendiente || !conIA || texto.trim().length < 20}
            className="btn-primary"
          >
            {pendiente ? "Leyendo tu plan…" : "Interpretar con IA"}
          </button>
          {!conIA ? <p className="text-xs text-warn">Necesita la IA configurada.</p> : null}
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-xs text-muted">
            {guardada ? "Es la lectura guardada de este texto: el mismo texto da siempre el mismo resultado. " : ""}
            <button type="button" onClick={() => interpretar(true)} disabled={pendiente} className="font-semibold text-accent">
              {pendiente ? "Leyendo…" : "Leer el texto de nuevo con IA"}
            </button>
          </p>
          {preview.descartados.length ? (
            <p className="rounded-xl border border-warn/50 px-3 py-2 text-sm text-warn">
              La IA propuso {preview.descartados.join(", ")}, que no {preview.descartados.length === 1 ? "está" : "están"} en
              tu texto: {preview.descartados.length === 1 ? "descartado" : "descartados"}.
            </p>
          ) : null}

          {preview.al_menu.length ? (
            <p className="rounded-xl border border-line px-3 py-2 text-sm text-muted">
              {preview.al_menu.join(", ")} {preview.al_menu.length === 1 ? "tiene" : "tienen"} calorías: va al menú, no al protocolo.
            </p>
          ) : null}

          {hayHorarios && h ? (
            <div className="rounded-xl border border-line p-3 text-sm">
              <p className="font-semibold">Horarios del texto</p>
              <ul className="mt-1 flex flex-col gap-0.5 text-muted">
                {h.despertar ? <li>Despertar · {fmtHora(h.despertar)}</li> : null}
                {h.entreno ? <li>Entreno · {fmtHora(h.entreno)}</li> : null}
                {h.comidas.map((c) => (
                  <li key={c.momento}>
                    {c.etiqueta || nombreMomento(c.momento)} → {nombreMomento(c.momento).toLowerCase()} · {fmtHora(c.hora)}
                  </li>
                ))}
                {h.dormir ? <li>Dormir · {fmtHora(h.dormir)}</li> : null}
              </ul>
              <label className="mt-2 flex items-start gap-2 text-sm">
                <input type="checkbox" checked={usarHorarios} onChange={(e) => setUsarHorarios(e.target.checked)} className="mt-1" />
                <span>Actualizar los horarios del cliente con estos (los puede ajustar después en “Cómo comes”)</span>
              </label>
            </div>
          ) : null}

          {preview.fases.length ? (
            <div className="rounded-xl border border-line p-3 text-sm">
              <p className="font-semibold">Fases del plan</p>
              <ul className="mt-1 flex flex-col gap-1">
                {preview.fases.map((f, i) => (
                  <li key={i}>
                    <span className="font-medium">{f.nombre}</span>{" "}
                    <span className="text-muted">· {textoDiasFase(preview.fases, i).toLowerCase()}</span>
                    {f.nota ? <span className="block text-xs text-muted">{f.nota}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="ptxt-ini">
              {preview.fases.length ? "Fecha de inicio (día 1 de la fase 1)" : "Fecha de inicio"}
            </label>
            <input id="ptxt-ini" type="date" className="input" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            <p className="mt-1 text-xs text-muted">
              {preview.fases.length
                ? "Desde ese día la app le va mostrando al cliente su fase y le avisa la víspera de cada cambio."
                : "El cliente lo ve en su checklist desde ese día."}
            </p>
          </div>

          {segmentos.map((s) => (
            <div key={s}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{s}</p>
              <ul className="mt-1 flex flex-col gap-1.5">
                {preview.items
                  .map((it, n) => ({ it, n }))
                  .filter(({ it }) => it.segmento === s)
                  .map(({ it, n }) => (
                    <li key={n} className="flex items-start justify-between gap-2 rounded-xl border border-line px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{it.titulo}</p>
                        {it.detalle ? <p className="text-xs text-muted">{it.detalle}</p> : null}
                        <p className="text-xs text-accent">
                          {textoCuando(it)} · {textoCuandoAplica(it)}
                        </p>
                        {it.porque ? <p className="text-xs italic text-muted">Por qué: {it.porque}</p> : null}
                      </div>
                      <button
                        type="button"
                        aria-label={`Quitar ${it.titulo}`}
                        onClick={() => setPreview({ ...preview, items: preview.items.filter((_, i) => i !== n) })}
                        className="shrink-0 px-1 text-danger"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          {!preview.items.length ? <p className="text-sm text-muted">No quedaron ítems de protocolo.</p> : null}

          {preview.fuera_protocolo.length ? (
            <div className="text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Fuera del protocolo</p>
              <ul className="mt-1 text-muted">
                {preview.fuera_protocolo.map((f) => (
                  <li key={f}>✕ {f}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.tiene_comidas ? (
            <p className="text-xs text-muted">
              El texto también trae comidas: después de guardar te ofrezco pasarlas al menú.
            </p>
          ) : null}
          <p className="text-xs text-muted">
            Guardar reemplaza el borrador del protocolo. El cliente sigue viendo lo que ya le enviaste hasta que
            envíes este. Los detalles se ajustan abajo, ítem por ítem.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={guardar} disabled={pendiente || !preview.items.length} className="btn-primary flex-1">
              {pendiente ? "Guardando…" : "Guardar como borrador"}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="btn-ghost">
              Volver
            </button>
          </div>
        </div>
      )}
      {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
    </section>
  );
}
