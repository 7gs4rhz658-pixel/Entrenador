import ProgresoCliente from "@/components/ProgresoCliente";
import { requireCliente } from "@/lib/auth";

export default async function ProgresoPage({
  searchParams
}: {
  searchParams?: { e?: string };
}) {
  const { userId } = await requireCliente();
  return (
    <main>
      <h1 className="mb-1 text-2xl font-bold">Progreso</h1>
      <ProgresoCliente userId={userId} ejercicioSel={searchParams?.e} base="/progreso" />
    </main>
  );
}
