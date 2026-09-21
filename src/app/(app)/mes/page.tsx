import Link from "next/link";
import { requireCliente } from "@/lib/auth";
import { getFotos, urlFoto } from "@/lib/data";
import { fmtFechaCorta, hoyFecha } from "@/lib/format";
import { estadoPago } from "@/lib/pagos";
import { resumenMes } from "@/lib/stats";

function Dato({ etiqueta, valor, sub }: { etiqueta: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-xs text-muted">{etiqueta}</p>
      <p className="text-xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
        {valor}
      </p>
      {sub ? <p className="text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

// "Tu mes": antes/después de las últimas 4 semanas cerradas, con los
// números reales. Es el momento de renovar: el recordatorio va acá.
export default async function MesPage() {
  const { perfil } = await requireCliente();
  const [mes, pago, fotos] = await Promise.all([resumenMes(perfil), Promise.resolve(estadoPago(perfil, hoyFecha())), getFotos(perfil.id)]);
  // Antes/después de frente: la foto más vieja y la más nueva
  const frentes = fotos.filter((f) => f.vista === "frente");
  const fotoAntes = frentes.length >= 2 ? frentes[frentes.length - 1] : null;
  const fotoDespues = frentes.length >= 2 ? frentes[0] : null;
  const [urlAntes, urlDespues] = await Promise.all([fotoAntes ? urlFoto(fotoAntes.path) : null, fotoDespues ? urlFoto(fotoDespues.path) : null]);

  if (!mes) {
    return (
      <main>
        <Link href="/" className="text-sm font-medium text-accent">
          ← Inicio
        </Link>
        <p className="card mt-3 text-center text-sm text-muted">
          Cuando cierres tu primera semana y hagas el check-in, acá vas a ver tu antes y después.
        </p>
      </main>
    );
  }

  const dPeso = mes.peso_inicial != null && mes.peso_final != null ? Math.round((mes.peso_final - mes.peso_inicial) * 10) / 10 : null;
  const dCint = mes.cintura_inicial != null && mes.cintura_final != null ? Math.round((mes.cintura_final - mes.cintura_inicial) * 10) / 10 : null;
  const signo = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  return (
    <main>
      <Link href="/" className="text-sm font-medium text-accent">
        ← Inicio
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Tu mes</h1>
      <p className="mb-4 text-sm text-muted">
        {mes.semanas} semana{mes.semanas === 1 ? "" : "s"} · {fmtFechaCorta(mes.desde)} → {fmtFechaCorta(mes.hasta)}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Dato
          etiqueta="Peso"
          valor={mes.peso_final != null ? `${mes.peso_final} kg` : "—"}
          sub={dPeso != null ? `${signo(dPeso)} kg desde ${mes.peso_inicial} kg` : undefined}
        />
        <Dato
          etiqueta="Cintura"
          valor={mes.cintura_final != null ? `${mes.cintura_final} cm` : "—"}
          sub={dCint != null ? `${signo(dCint)} cm` : "sin medida"}
        />
        <Dato etiqueta="Entrenos" valor={`${mes.entrenos_hechos}/${mes.entrenos_planificados}`} sub={`${mes.series} series registradas`} />
        <Dato
          etiqueta="Comidas del menú"
          valor={mes.comidas_menu_esperadas ? `${Math.round((mes.comidas_menu_hechas / mes.comidas_menu_esperadas) * 100)} %` : "—"}
          sub={mes.comidas_menu_esperadas ? `${mes.comidas_menu_hechas} de ${mes.comidas_menu_esperadas}` : "sin menú"}
        />
      </div>

      <section className="card mt-3">
        <h2 className="font-bold">Cargas: de dónde arrancaste a dónde estás</h2>
        {mes.cargas.length ? (
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {mes.cargas.map((c) => (
              <li key={c.ejercicio} className="flex items-center justify-between gap-2">
                <span className="truncate">{c.ejercicio}</span>
                <span className="shrink-0 font-semibold text-ok" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {c.inicio_kg} → {c.fin_kg} kg
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">Todavía no hay subidas de carga planificadas. Llegan con las semanas.</p>
        )}
      </section>

      {urlAntes && urlDespues && fotoAntes && fotoDespues ? (
        <section className="card mt-3">
          <h2 className="font-bold">Antes y después</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              { t: "Antes", f: fotoAntes, u: urlAntes },
              { t: "Después", f: fotoDespues, u: urlDespues }
            ].map((c) => (
              <div key={c.t}>
                <p className="mb-1 text-xs text-muted">
                  {c.t} · {fmtFechaCorta(c.f.fecha)}
                </p>
                <div className="aspect-[3/4] overflow-hidden rounded-xl border border-line bg-surface2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.u} alt={`${c.t} de frente`} className="h-full w-full object-cover" />
                </div>
              </div>
            ))}
          </div>
          <Link href="/progreso?tab=fotos" className="mt-2 block text-right text-xs font-semibold text-accent">
            Todas las fotos →
          </Link>
        </section>
      ) : null}

      {mes.medidas.length ? (
        <section className="card mt-3">
          <h2 className="font-bold">Medidas</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {mes.medidas.map((c) => (
              <li key={c.medida} className="flex items-center justify-between gap-2">
                <span>{c.medida}</span>
                <span className={`shrink-0 font-semibold ${c.medida === "Cintura" || c.medida === "Cadera" ? (c.ahora < c.antes ? "text-ok" : "text-warn") : c.ahora > c.antes ? "text-ok" : "text-warn"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {c.antes} → {c.ahora} cm ({signo(Math.round((c.ahora - c.antes) * 10) / 10)})
                </span>
              </li>
            ))}
          </ul>
          <Link href="/progreso?tab=medidas" className="mt-2 block text-right text-xs font-semibold text-accent">
            Todas las medidas →
          </Link>
        </section>
      ) : (
        <Link href="/progreso?tab=medidas" className="card mt-3 block text-sm">
          <p className="font-semibold">Medidas</p>
          <p className="mt-1 text-muted">Cargá tus medidas una vez por semana y acá ves el antes y después →</p>
        </Link>
      )}

      <section className="card mt-3 text-sm">
        <h2 className="font-bold">Cómo te sentiste</h2>
        <p className="mt-1 text-muted">
          Energía {mes.energia_promedio ?? "—"}/5 · sueño {mes.sueno_promedio ?? "—"}/5 · {mes.informes_aprobados} informe
          {mes.informes_aprobados === 1 ? "" : "s"} de tu entrenador
        </p>
      </section>

      {pago.pagado && pago.diasRestantes != null && (pago.vencido || pago.diasRestantes <= 7) ? (
        <Link href="/pago" className="card mt-3 block border-accent/60">
          <p className="font-semibold">{pago.vencido ? "Tu mes venció" : `Tu mes vence en ${pago.diasRestantes} día${pago.diasRestantes === 1 ? "" : "s"}`}</p>
          <p className="mt-1 text-sm text-muted">
            El próximo bloque arranca desde tus últimos pesos y tu menú sigue igual. Renovar →
          </p>
        </Link>
      ) : null}
    </main>
  );
}
