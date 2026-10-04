import { redirect } from "next/navigation";
import CuestionarioComidaForm from "@/components/CuestionarioComidaForm";
import { requireSesion } from "@/lib/auth";

export default async function CuestionarioComidaPage() {
  const { perfil } = await requireSesion();
  if (perfil.rol === "entrenador") redirect("/entrenador");
  if (!perfil.cuestionario) redirect("/cuestionario");

  return (
    <main>
      <header className="mb-5 text-center">
        <div className="mb-2 text-4xl">🥗</div>
        <h1 className="text-2xl font-bold">
          {perfil.cuestionario_nutricion ? "Actualiza cómo comes" : "Ahora, cómo comes"}
        </h1>
        <p className="mt-1 text-muted">
          Con esto tu entrenador arma una recomendación de comidas a tu medida: tus
          horarios, lo que no comes y cómo cocinas.
        </p>
      </header>
      <CuestionarioComidaForm perfil={perfil} />
    </main>
  );
}
