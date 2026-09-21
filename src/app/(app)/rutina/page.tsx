import RutinaDia from "@/components/RutinaDia";
import { requireCliente } from "@/lib/auth";
import {
  ejerciciosPorDia,
  getBloque,
  getDias,
  getEjercicios,
  getPlanes,
  planesPorEjercicio
} from "@/lib/data";

export default async function RutinaPage() {
  const { userId } = await requireCliente();
  const [meso, dias, ejercicios] = await Promise.all([
    getBloque(userId),
    getDias(userId),
    getEjercicios(userId)
  ]);
  const planes = meso
    ? planesPorEjercicio(await getPlanes(meso.id, meso.semana_actual))
    : {};
  const porDia = ejerciciosPorDia(ejercicios);

  if (!meso) {
    return (
      <main>
        <h1 className="mb-3 text-2xl font-bold">Rutina</h1>
        <p className="card text-center text-sm text-muted">
          Tu entrenador está armando tu rutina. Cuando la envíe te llega un aviso y la ves acá.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1 className="mb-1 text-2xl font-bold">Rutina</h1>
      <p className="mb-4 text-sm text-muted">
        Agregá, editá o quitá días y ejercicios cuando quieras. Los cambios de
        series, reps y peso aplican a la semana actual
        {meso ? ` (semana ${meso.semana_actual})` : ""} y la progresión sigue
        desde ahí.
      </p>
      <div className="flex flex-col gap-3">
        {dias.map((dia) => (
          <RutinaDia
            key={dia.id}
            dia={dia}
            ejercicios={(porDia[dia.id] ?? []).sort((a, b) => a.orden - b.orden)}
            planes={planes}
          />
        ))}
      </div>
    </main>
  );
}
