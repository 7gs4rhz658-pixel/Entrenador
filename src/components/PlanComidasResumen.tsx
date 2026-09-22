import { comidasPorMomento, ordenarPorHorario, TIPOS_DIA } from "@/lib/meal-plan";
import { ETIQUETAS_TIPO_DIA, nombreMomento } from "@/lib/nutrition";
import type { PlanComidasActivo } from "@/lib/data";
import type { CuestionarioNutricion } from "@/lib/types";

// Menú activo del cliente, visto por el entrenador: los dos tipos de día
// con sus comidas y macros reales.
export default function PlanComidasResumen({
  plan,
  cn
}: {
  plan: PlanComidasActivo;
  cn: CuestionarioNutricion | null;
}) {
  return (
    <section className="card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">{plan.plan.nombre}</h2>
        <span className="text-xs text-muted">
          origen: {plan.plan.origen} · {new Date(plan.plan.created_at).toLocaleDateString("es-MX")}
          {!plan.plan.publicado ? <span className="ml-2 chip border-warn/40 text-warn">borrador sin enviar</span> : null}
        </span>
      </div>
      {plan.plan.notas ? <p className="mt-1 text-sm text-muted">{plan.plan.notas}</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {TIPOS_DIA.map((tipo) => {
          const comidas = ordenarPorHorario(comidasPorMomento(plan.items, tipo), cn);
          const total = comidas.reduce(
            (a, c) => ({
              kcal: a.kcal + c.macros.kcal,
              prot_g: a.prot_g + c.macros.prot_g,
              carb_g: a.carb_g + c.macros.carb_g,
              grasa_g: a.grasa_g + c.macros.grasa_g
            }),
            { kcal: 0, prot_g: 0, carb_g: 0, grasa_g: 0 }
          );
          return (
            <div key={tipo} className="rounded-xl border border-line p-3">
              <p className="font-semibold">{ETIQUETAS_TIPO_DIA[tipo]}</p>
              <p className="text-xs text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                {Math.round(total.kcal)} kcal · P {Math.round(total.prot_g)} · C {Math.round(total.carb_g)} · G{" "}
                {Math.round(total.grasa_g)}
              </p>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {comidas.map((c) => (
                  <li key={c.momento}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {nombreMomento(c.momento)}
                      {c.plato ? ` · ${c.plato}` : ""}
                    </p>
                    <p className="text-muted">
                      {c.items.map((i) => `${i.ingredient.nombre} ${Math.round(i.cantidad_g)} g`).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
