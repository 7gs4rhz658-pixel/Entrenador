import Link from "next/link";
import { redirect } from "next/navigation";
import CheckinForm from "@/components/CheckinForm";
import { requireCliente } from "@/lib/auth";
import { checkinPendiente } from "@/lib/stats";

// Calcular el resumen y redactar el informe llama a la IA.
export const maxDuration = 60;

export default async function CheckinPage() {
  const { userId, perfil } = await requireCliente();
  const pendiente = await checkinPendiente(userId);
  if (!pendiente) redirect("/");

  return (
    <main>
      <Link href="/" className="text-sm font-medium text-accent">
        ← Inicio
      </Link>
      <header className="mb-5 mt-2">
        <h1 className="text-2xl font-bold">Check-in de la semana {pendiente.semana}</h1>
        <p className="mt-1 text-muted">
          Un minuto. Con esto y tus registros tu entrenador te manda el informe de la semana.
        </p>
      </header>
      <CheckinForm mesoId={pendiente.mesoId} semana={pendiente.semana} pesoActual={perfil.peso_kg} />
    </main>
  );
}
