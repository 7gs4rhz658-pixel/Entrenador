import Link from "next/link";
import { redirect } from "next/navigation";
import CambiarClaveForm from "@/components/CambiarClaveForm";
import LogoutButton from "@/components/LogoutButton";
import { destinoInicial, getSesion } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Cambio de contraseña sin correo: obligatorio al entrar con la temporal
// que dio el entrenador, y opcional desde Perfil.
export default async function NuevaClavePage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  const obligatoria = sesion.perfil.debe_cambiar_clave;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-6 text-center">
        <div className="mb-3 text-4xl">🔑</div>
        <h1 className="text-2xl font-bold">{obligatoria ? "Elige tu contraseña" : "Cambiar contraseña"}</h1>
        <p className="mt-1 text-muted">
          {obligatoria
            ? "Entraste con una contraseña temporal de tu entrenador. Crea una nueva que solo tú conozcas."
            : "Escribe tu contraseña nueva dos veces."}
        </p>
      </div>
      <CambiarClaveForm />
      <div className="mt-6">
        {obligatoria ? (
          <LogoutButton />
        ) : (
          <Link href={destinoInicial(sesion.perfil) === "/entrenador" ? "/entrenador" : "/perfil"} className="btn-ghost w-full">
            Cancelar
          </Link>
        )}
      </div>
    </main>
  );
}
