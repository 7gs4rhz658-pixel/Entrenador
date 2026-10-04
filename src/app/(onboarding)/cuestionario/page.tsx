import { redirect } from "next/navigation";
import CuestionarioForm from "@/components/CuestionarioForm";
import { requireSesion } from "@/lib/auth";

export default async function CuestionarioPage() {
  const { perfil } = await requireSesion();
  if (perfil.rol === "entrenador") redirect("/entrenador");

  return (
    <main>
      <header className="mb-5 text-center">
        <div className="mb-2 text-4xl">📋</div>
        <h1 className="text-2xl font-bold">
          {perfil.onboarding_completo
            ? "Actualiza tu cuestionario"
            : `¡Hola, ${perfil.nombre || "bienvenido"}!`}
        </h1>
        <p className="mt-1 text-muted">
          Con esto armamos tu plan de entrenamiento y tus calorías y macros
          diarios. Puedes editarlo después desde Perfil.
        </p>
      </header>
      <CuestionarioForm perfil={perfil} />
    </main>
  );
}
