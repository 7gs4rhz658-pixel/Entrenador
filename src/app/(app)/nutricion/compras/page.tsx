import Link from "next/link";
import ListaCompras from "@/components/ListaCompras";
import { requireCliente } from "@/lib/auth";
import { contarDiasEntreno, getPlanComidas } from "@/lib/data";
import { nombreDia } from "@/lib/format";
import { listaCompras, textoCompras } from "@/lib/meal-plan";

// Lista de compras y guía de batch cooking derivadas del menú activo.
export default async function ComprasPage() {
  const { userId, perfil } = await requireCliente();
  const [plan, diasEntreno] = await Promise.all([getPlanComidas(userId), contarDiasEntreno(userId)]);

  if (!plan) {
    return (
      <main>
        <Link href="/nutricion" className="text-sm font-medium text-accent">
          ← Comida
        </Link>
        <p className="card mt-3 text-center text-sm text-muted">
          Cuando tu entrenador cargue tu recomendación de comidas, acá vas a tener la lista de
          compras y la guía para cocinar la semana.
        </p>
      </main>
    );
  }

  const lista = listaCompras(plan.items, diasEntreno);
  const batch = plan.plan.batch_cooking;
  const cn = perfil.cuestionario_nutricion;

  return (
    <main>
      <Link href="/nutricion" className="text-sm font-medium text-accent">
        ← Comida
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Compras y batch cooking</h1>
      <p className="mb-4 text-sm text-muted">
        Calculado con tu menú: {diasEntreno} día{diasEntreno === 1 ? "" : "s"} de entreno y{" "}
        {7 - diasEntreno} de descanso por semana.
      </p>

      <div className="flex flex-col gap-3">
        <ListaCompras planId={plan.plan.id} lista={lista} texto={textoCompras(lista)} />

        {batch ? (
          <section className="card">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-bold">Cociná una vez para la semana</h2>
              <span className="text-xs text-muted">
                {nombreDia(cn?.dia_batch ?? batch.dia_semana)} · ~{batch.tiempo_min} min
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {batch.tandas.map((t) => (
                <div key={t.tecnica} className="rounded-xl border border-line px-3 py-2 text-sm">
                  <p className="font-semibold">{t.tecnica}</p>
                  <p className="text-muted">
                    {t.items.map((i) => `${i.nombre} ${i.gramos_semana >= 1000 ? `${(i.gramos_semana / 1000).toFixed(1)} kg` : `${Math.round(i.gramos_semana)} g`}`).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
            <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm">
              {batch.pasos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
            {batch.conservacion.length ? (
              <div className="mt-3 text-sm">
                <p className="font-semibold">Cómo guardar</p>
                <ul className="mt-1 flex flex-col gap-0.5 text-muted">
                  {batch.conservacion.map((c) => (
                    <li key={c}>• {c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
