import Link from "next/link";
import { requireCliente } from "@/lib/auth";
import { getPlanComidas, getProtocolo } from "@/lib/data";
import { DESCARGO_PROTOCOLO } from "@/lib/descargo";
import { hoyFecha, sumarDias } from "@/lib/format";
import { aHora, diaDelProtocolo, faseDelDia, fmtHora, horaDelItem, horarioDelDia } from "@/lib/hoy";
import { SEGMENTOS, textoCuando, textoCuandoAplica, textoDiasFase } from "@/lib/protocolo";

// "lunes 12 de oct."
function fecha(f: string): string {
  return new Date(`${f}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
}

// Protocolo completo del cliente, por segmento: qué, cuándo (con su hora
// según sus horarios), qué días y por qué. En Hoy aparece cada cosa a su hora.
export default async function ProtocoloPage() {
  const { userId, perfil } = await requireCliente();
  const protocolo = await getProtocolo(userId);

  if (!protocolo) {
    return (
      <main>
        <h1 className="mb-3 text-2xl font-bold">Protocolo</h1>
        <p className="card text-center text-sm text-muted">
          Tu entrenador todavía no te asignó un protocolo (suplementos, hábitos, cuidado personal). Cuando lo haga
          te llega un aviso y aparece en tu checklist de Hoy.
        </p>
      </main>
    );
  }

  // Horas con el menú del día de entreno (o el de descanso para lo que
  // solo va esos días)
  const plan = await getPlanComidas(userId);
  const horarioDe = (aplica: string) =>
    horarioDelDia(perfil.cuestionario_nutricion, plan?.plan.horarios?.[aplica === "descanso" ? "descanso" : "entreno"] ?? {}, 60);
  const hoy = hoyFecha();
  const fases = protocolo.protocolo.fases;
  const actual = faseDelDia(fases, Math.max(1, diaDelProtocolo(protocolo.inicio, hoy)));
  const empezo = hoy >= protocolo.inicio;
  const segmentos = [...new Set([...SEGMENTOS, ...protocolo.items.map((i) => i.segmento)])];
  const grupos = segmentos
    .map((s) => ({ segmento: s, lista: protocolo.items.filter((i) => i.segmento === s).sort((a, b) => a.orden - b.orden) }))
    .filter((g) => g.lista.length);

  return (
    <main>
      <Link href="/" className="text-sm font-medium text-accent">
        ← Hoy
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{protocolo.protocolo.nombre}</h1>
      <p className="mb-4 text-sm text-muted">
        De tu entrenador · {empezo ? "desde" : "empieza"} el {fecha(protocolo.inicio)}. Cada cosa aparece en tu checklist
        de Hoy a su hora.
      </p>

      <div className="flex flex-col gap-3">
        {fases.length ? (
          <section className="card">
            <h2 className="font-bold">Fases</h2>
            <ol className="mt-2 flex flex-col gap-2">
              {fases.map((f, i) => {
                const desde = sumarDias(protocolo.inicio, f.desde_dia - 1);
                const sig = fases[i + 1];
                const hasta = sig ? sumarDias(protocolo.inicio, sig.desde_dia - 2) : null;
                const esActual = empezo && actual === i + 1;
                const pasada = empezo && actual != null && i + 1 < actual;
                const nuevos = [...new Set(protocolo.items.filter((it) => (it.fase_desde ?? 1) === i + 1).map((it) => it.titulo))];
                return (
                  <li
                    key={i}
                    className={`rounded-xl border px-3 py-2 ${esActual ? "border-accent" : "border-line"} ${pasada ? "opacity-60" : ""}`}
                  >
                    <p className="text-sm font-semibold">
                      {pasada ? "✓ " : ""}
                      {f.nombre}
                      {esActual ? <span className="ml-1.5 chip border-accent px-2 py-0 text-[11px] text-accent">Ahora</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {textoDiasFase(fases, i)} · {fecha(desde)}
                      {hasta ? ` al ${fecha(hasta)}` : " en adelante"}
                    </p>
                    {f.nota ? <p className="mt-0.5 text-xs text-muted">{f.nota}</p> : null}
                    {nuevos.length ? (
                      <p className="mt-0.5 text-xs">
                        {i === 0 ? "Empiezas con" : "Se suma"}: {nuevos.join(", ")}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {grupos.map((g) => (
          <section key={g.segmento} className="card">
            <h2 className="font-bold">{g.segmento}</h2>
            <ul className="mt-2 flex flex-col divide-y divide-line">
              {g.lista.map((it) => {
                const h = horaDelItem(it, horarioDe(it.aplica), 60);
                return (
                  <li key={it.id} className="py-2 first:pt-0 last:pb-0">
                    <p className="font-semibold">{it.titulo}</p>
                    {it.detalle ? <p className="text-sm text-muted">{it.detalle}</p> : null}
                    <p className="mt-0.5 text-xs text-accent">
                      {textoCuando(it)}
                      {h?.real && it.ancla !== "hora_fija" ? ` (${fmtHora(aHora(h.min))})` : ""} · {textoCuandoAplica(it)}
                    </p>
                    {it.porque ? <p className="mt-1 text-xs text-muted">Por qué: {it.porque}</p> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {protocolo.protocolo.fuera_protocolo.length ? (
          <section className="card">
            <h2 className="font-bold">Fuera del protocolo</h2>
            <p className="text-xs text-muted">No hace falta que lo compres ni lo uses.</p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {protocolo.protocolo.fuera_protocolo.map((f) => (
                <li key={f}>✕ {f}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-xs text-muted">{DESCARGO_PROTOCOLO}</p>
        <p className="text-xs text-muted">
          Las horas salen de los horarios que cargaste en{" "}
          <Link href="/cuestionario/comida" className="font-semibold text-accent">
            Cómo comes
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
