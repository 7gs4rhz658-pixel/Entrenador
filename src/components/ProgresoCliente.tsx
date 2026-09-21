import Link from "next/link";
import ProgressChart, { type PuntoProgreso } from "@/components/ProgressChart";
import {
  getBloque,
  getDias,
  getEjercicios,
  getLogsEjercicio,
  getRecords,
  getSesiones
} from "@/lib/data";
import { fmtFechaCorta, fmtNum, nombreDia } from "@/lib/format";

// Sección de progreso reutilizable: la ve el cliente en /progreso y el
// entrenador dentro de la ficha de cada cliente. Server component.
export default async function ProgresoCliente({
  userId,
  ejercicioSel,
  base
}: {
  userId: string;
  ejercicioSel?: string;
  base: string; // ruta a la que apuntan los chips (?e=)
}) {
  const [meso, dias, ejercicios, sesiones, records] = await Promise.all([
    getBloque(userId, { conBorrador: true }),
    getDias(userId),
    getEjercicios(userId),
    getSesiones(userId, 8),
    getRecords(userId, 10)
  ]);
  const ultimas = sesiones.slice(0, 4);
  const minutosProm = ultimas.length ? Math.round(ultimas.reduce((a, x) => a + x.duracion_seg, 0) / ultimas.length / 60) : null;

  if (!meso || ejercicios.length === 0) {
    return (
      <p className="card text-center text-muted">
        Todavía no hay datos. Cuando haya rutina y registros aparecen acá.
      </p>
    );
  }

  // Ejercicios ordenados por día de la semana y orden interno
  const ordenDia: Record<string, number> = {};
  for (const d of dias) ordenDia[d.id] = d.dia_semana;
  const ordenados = [...ejercicios].sort(
    (a, b) =>
      (ordenDia[a.training_day_id] ?? 9) - (ordenDia[b.training_day_id] ?? 9) ||
      a.orden - b.orden
  );

  const sel = ordenados.find((e) => e.id === ejercicioSel) ?? ordenados[0];
  const esKg = sel.unidad === "kg";
  const sufijo = esKg ? "kg" : "reps";
  const sep = base.includes("?") ? "&" : "?";

  const logs = await getLogsEjercicio(meso.id, sel.id);
  const puntos: PuntoProgreso[] = Array.from(
    { length: meso.total_semanas },
    (_, i) => {
      const semana = i + 1;
      const deLaSemana = logs.filter(
        (l) => l.semana === semana && l.completado
      );
      const valores = deLaSemana
        .map((l) => (esKg ? l.peso_kg : l.reps))
        .filter((v): v is number => v != null);
      return {
        semana,
        valor: valores.length ? Math.max(...valores) : null
      };
    }
  );
  const hayDatos = puntos.some((p) => p.valor != null);
  const diaDelSel = dias.find((d) => d.id === sel.training_day_id);

  return (
    <>
      <p className="mb-3 text-sm text-muted">
        {meso.nombre} · {esKg ? "mejor peso" : "mejores reps"} por semana
        {minutosProm ? ` · sesiones de ~${minutosProm} min (últimas ${ultimas.length})` : ""}
      </p>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        {ordenados.map((ex) => (
          <Link
            key={ex.id}
            href={`${base}${sep}e=${ex.id}`}
            className={`chip shrink-0 whitespace-nowrap px-3 py-1.5 text-sm ${
              ex.id === sel.id
                ? "border-accent bg-accent/15 text-accent"
                : "border-line text-muted"
            }`}
          >
            {ex.nombre}
          </Link>
        ))}
      </div>

      <section className="card">
        <h2 className="font-bold">{sel.nombre}</h2>
        <p className="text-xs text-muted">
          {diaDelSel
            ? `${nombreDia(diaDelSel.dia_semana)}${diaDelSel.nombre ? ` — ${diaDelSel.nombre}` : ""}`
            : ""}
        </p>
        {hayDatos ? (
          <div className="mt-3">
            <ProgressChart puntos={puntos} sufijo={sufijo} />
          </div>
        ) : (
          <p className="mt-4 text-center text-sm text-muted">
            Sin registros todavía para este ejercicio.
          </p>
        )}
      </section>

      {hayDatos ? (
        <section className="card mt-3">
          <h3 className="mb-2 text-sm font-semibold text-muted">
            Detalle por semana
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium">Semana</th>
                <th className="py-1 text-right font-medium">
                  {esKg ? "Mejor peso (kg)" : "Mejores reps"}
                </th>
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
              {puntos.map((p) => (
                <tr key={p.semana} className="border-t border-line">
                  <td className="py-1.5">Semana {p.semana}</td>
                  <td className="py-1.5 text-right font-semibold">
                    {p.valor != null ? fmtNum(p.valor) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {records.length ? (
        <section className="card mt-3">
          <h2 className="font-bold">🏆 Récords personales</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {records.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {r.ejercicio}
                  <span className="ml-1 text-xs text-muted">{fmtFechaCorta(r.fecha)}</span>
                </span>
                <span className="shrink-0 font-semibold text-ok" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmtNum(Number(r.valor))} {r.tipo === "peso" ? "kg" : "reps"}
                  {r.anterior != null ? <span className="font-normal text-muted"> (antes {fmtNum(Number(r.anterior))})</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
