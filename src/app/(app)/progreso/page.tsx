import Link from "next/link";
import MedidasForm from "@/components/MedidasForm";
import MedidasHistorial from "@/components/MedidasHistorial";
import ProgresoCliente from "@/components/ProgresoCliente";
import { requireCliente } from "@/lib/auth";
import { getMedidas } from "@/lib/data";
import { hoyFecha } from "@/lib/format";

const TABS = [
  { id: "fuerza", texto: "Fuerza" },
  { id: "medidas", texto: "Medidas" }
] as const;

export default async function ProgresoPage({
  searchParams
}: {
  searchParams?: { e?: string; tab?: string };
}) {
  const { userId, perfil } = await requireCliente();
  const tab = TABS.find((t) => t.id === searchParams?.tab)?.id ?? "fuerza";
  return (
    <main>
      <h1 className="mb-3 text-2xl font-bold">Progreso</h1>
      <nav className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/progreso?tab=${t.id}`}
            className={`chip px-3 py-1.5 text-sm ${t.id === tab ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"}`}
          >
            {t.texto}
          </Link>
        ))}
      </nav>
      {tab === "medidas" ? (
        <Medidas userId={userId} pesoActual={perfil.peso_kg} />
      ) : (
        <ProgresoCliente userId={userId} ejercicioSel={searchParams?.e} base="/progreso?tab=fuerza" />
      )}
    </main>
  );
}

async function Medidas({ userId, pesoActual }: { userId: string; pesoActual: number | null }) {
  const medidas = await getMedidas(userId);
  return (
    <div className="flex flex-col gap-3">
      <MedidasForm hoy={hoyFecha()} ultima={medidas[0] ?? null} pesoActual={pesoActual} />
      <MedidasHistorial medidas={medidas} />
    </div>
  );
}
