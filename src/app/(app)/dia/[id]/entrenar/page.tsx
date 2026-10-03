import { notFound, redirect } from "next/navigation";
import Entrenar from "@/components/Entrenar";
import { requireCliente } from "@/lib/auth";
import {
  getBloque,
  getDiaPorId,
  getEjercicios,
  getLogs,
  getPlanes,
  logsPorEjercicio,
  planesPorEjercicio
} from "@/lib/data";
import { nombreDia } from "@/lib/format";
import { activoEnSemana } from "@/lib/rutina";

export default async function EntrenarPage({ params }: { params: { id: string } }) {
  const { userId } = await requireCliente();
  const dia = await getDiaPorId(params.id);
  if (!dia || dia.user_id !== userId) notFound();
  const meso = await getBloque(userId);
  if (!meso) redirect("/");
  const semana = meso.semana_actual;

  const [ejercicios, planes, logs, logsPrev] = await Promise.all([
    getEjercicios(userId),
    getPlanes(meso.id, semana),
    getLogs(meso.id, semana),
    semana > 1 ? getLogs(meso.id, semana - 1) : Promise.resolve([])
  ]);
  const exsDia = ejercicios
    .filter((e) => e.training_day_id === dia.id && activoEnSemana(e, semana))
    .sort((a, b) => a.orden - b.orden);
  if (!exsDia.length) redirect(`/dia/${dia.id}`);

  return (
    <Entrenar
      diaId={dia.id}
      titulo={`${nombreDia(dia.dia_semana)}${dia.nombre ? ` — ${dia.nombre}` : ""}`}
      mesoId={meso.id}
      semana={semana}
      ejercicios={exsDia}
      planes={planesPorEjercicio(planes)}
      logs={logsPorEjercicio(logs)}
      logsPrev={logsPorEjercicio(logsPrev)}
      fases={meso.fases}
      conRango={meso.progresion === "plan"}
    />
  );
}
