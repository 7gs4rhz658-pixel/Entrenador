import Link from "next/link";
import MarcarComida from "@/components/MarcarComida";
import { DESCARGO_CORTO } from "@/lib/descargo";
import { horaDe, notaUtil, type RecomendacionDia } from "@/lib/meal-plan";
import { ETIQUETAS_TIPO_DIA, nombreMomento } from "@/lib/nutrition";
import type { AsistenteLog, MealLog, Profile } from "@/lib/types";

// Menú recomendado para un día (entreno o descanso) con "La comí" por
// comida. Lo usa el cliente en Comida y el entrenador en la ficha.
export default function ComidasDelDia({
  perfil,
  fecha,
  reco,
  comidasRegistradas,
  titulo,
  userIdProp,
  compacto = false,
  mostrarAvisos = true,
  ajuste = null
}: {
  perfil: Profile;
  fecha: string;
  reco: RecomendacionDia;
  comidasRegistradas: MealLog[];
  titulo: string;
  userIdProp?: string;
  compacto?: boolean;
  mostrarAvisos?: boolean;
  ajuste?: AsistenteLog | null;
}) {
  const hechos = new Set(comidasRegistradas.map((c) => c.plan_item_id).filter(Boolean));
  const cn = perfil.cuestionario_nutricion;

  return (
    <section className="card">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="font-bold">{titulo}</h2>
          <p className="text-xs text-muted">{ETIQUETAS_TIPO_DIA[reco.tipo]} · menú recomendado</p>
        </div>
        {compacto ? (
          <Link href="/nutricion" className="shrink-0 text-xs font-semibold text-accent">
            Ver detalle →
          </Link>
        ) : (
          <Link href="/nutricion/compras" className="shrink-0 text-xs font-semibold text-accent">
            🛒 Compras
          </Link>
        )}
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {reco.comidas.map((c) => {
          const hecha = c.items.every((i) => hechos.has(i.id));
          const hora = horaDe(c.momento, cn, c.hora);
          return (
            <li key={c.momento} className="rounded-xl border border-line px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {nombreMomento(c.momento)}
                    {hora ? ` · ${hora}` : ""}
                  </p>
                  <p className="font-semibold leading-snug">{c.plato || nombreMomento(c.momento)}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {c.items
                      .map((i) => {
                        const nota = notaUtil(i.ingredient.nombre, i.nota);
                        return `${i.ingredient.nombre} ${Math.round(i.cantidad_g)} g${nota ? ` (${nota})` : ""}`;
                      })
                      .join(" · ")}
                  </p>
                  {!compacto ? (
                    <p className="mt-0.5 text-xs text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {c.macros.kcal} kcal · P {c.macros.prot_g} · C {c.macros.carb_g} · G {c.macros.grasa_g}
                    </p>
                  ) : null}
                </div>
                {!compacto ? (
                  <MarcarComida userId={userIdProp} fecha={fecha} tipo={reco.tipo} momento={c.momento} hecha={hecha} />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {ajuste ? (
        <div className="mt-3 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          <p className="font-semibold text-accent">Ajuste de hoy · {ajuste.respuesta.resumen}</p>
          {ajuste.respuesta.reacomodo_dia.length ? (
            <ul className="mt-1 flex flex-col gap-0.5">
              {ajuste.respuesta.reacomodo_dia.map((r, i) => (
                <li key={i}>
                  <span className="text-muted">{r.momento === "general" ? "En general" : nombreMomento(r.momento)}:</span> {r.cambio}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {mostrarAvisos && reco.avisos.length ? (
        <div className="mt-3 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm">
          <p className="font-semibold text-warn">Para dejar listo</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-ink">
            {reco.avisos.map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!compacto ? (
        <>
          {reco.notas ? <p className="mt-3 text-sm text-muted">{reco.notas}</p> : null}
          <p className="mt-2 text-xs text-muted">
            Marca cada comida cuando la hagas y se suma a tus barras. Para cambiar un ingrediente,
            márcala y usa &quot;Sustituir un ingrediente&quot; más abajo. {DESCARGO_CORTO}
          </p>
        </>
      ) : null}
    </section>
  );
}
