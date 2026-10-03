import { LineaFases, TarjetaFase } from "@/components/FasesRutina";
import RutinaDia from "@/components/RutinaDia";
import { requireCliente } from "@/lib/auth";
import { ejerciciosPorDia, getBloque, getDias, getEjercicios, getPlanesVista } from "@/lib/data";

export default async function RutinaPage() {
  const { userId } = await requireCliente();
  const [meso, dias, ejercicios] = await Promise.all([getBloque(userId), getDias(userId), getEjercicios(userId)]);
  const planes = meso ? await getPlanesVista(meso.id, meso.semana_actual) : {};
  const porDia = ejerciciosPorDia(ejercicios);

  if (!meso) {
    return (
      <main>
        <h1 className="mb-3 text-2xl font-bold">Rutina</h1>
        <p className="card text-center text-sm text-muted">
          Tu entrenador está armando tu rutina. Cuando la envíe te llega un aviso y la ves aquí.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1 className="mb-1 text-2xl font-bold">Rutina</h1>
      {meso.notas ? <p className="mb-3 text-sm text-muted">{meso.notas}</p> : null}
      <LineaFases fases={meso.fases} semana={meso.semana_actual} />
      <TarjetaFase fases={meso.fases} semana={meso.semana_actual} />
      <p className="mb-4 text-sm text-muted">
        Puedes agregar, editar o quitar días y ejercicios cuando quieras. Los cambios de series, reps y peso aplican a
        la semana actual (semana {meso.semana_actual}) y la progresión sigue desde ahí.
      </p>
      <div className="flex flex-col gap-3">
        {dias.map((dia) => (
          <RutinaDia
            key={dia.id}
            dia={dia}
            ejercicios={(porDia[dia.id] ?? []).sort((a, b) => a.orden - b.orden)}
            planes={planes}
            semana={meso.semana_actual}
            fases={meso.fases}
            conRango={meso.progresion === "plan"}
          />
        ))}
      </div>
    </main>
  );
}
