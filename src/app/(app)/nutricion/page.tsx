import NutricionDia from "@/components/NutricionDia";
import { requireCliente } from "@/lib/auth";
import { hoyFecha } from "@/lib/format";

// Sustituciones y recetas consultan a la IA.
export const maxDuration = 60;

export default async function NutricionPage({
  searchParams
}: {
  searchParams?: { fecha?: string };
}) {
  const { perfil } = await requireCliente();
  const hoy = hoyFecha();
  const f = searchParams?.fecha;
  const fecha = f && /^\d{4}-\d{2}-\d{2}$/.test(f) && f <= hoy ? f : hoy;

  return (
    <main>
      <h1 className="mb-3 text-2xl font-bold">Comida</h1>
      <NutricionDia perfil={perfil} fecha={fecha} base="/nutricion" />
    </main>
  );
}
