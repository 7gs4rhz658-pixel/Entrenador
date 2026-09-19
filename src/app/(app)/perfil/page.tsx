import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import ProfileForm from "@/components/ProfileForm";
import { requireCliente } from "@/lib/auth";
import { getBloque } from "@/lib/data";

export default async function PerfilPage() {
  const { userId, perfil } = await requireCliente();
  const meso = await getBloque(userId);

  return (
    <main>
      <h1 className="mb-1 text-2xl font-bold">Perfil</h1>
      <p className="mb-4 text-sm text-muted">
        Si actualizás tu peso u objetivo, las calorías y los macros se
        recalculan solos.
      </p>

      <ProfileForm perfil={perfil} />

      {meso ? (
        <section className="card mt-4 text-sm">
          <p className="font-semibold">Bloque actual</p>
          <p className="mt-1 text-muted">
            {meso.nombre} · Semana {meso.semana_actual} de {meso.total_semanas} ·{" "}
            {meso.estado === "activo" ? "en curso" : "finalizado"} · inicio{" "}
            {new Date(`${meso.fecha_inicio}T12:00:00`).toLocaleDateString("es-AR")}
          </p>
        </section>
      ) : null}

      <section className="card mt-4 text-sm">
        <p className="font-semibold">Cuestionario inicial</p>
        <p className="mt-1 text-muted">
          Días, experiencia, equipamiento y lesiones que usamos para armar tu
          plan.{" "}
          <Link href="/cuestionario" className="font-semibold text-accent">
            Editar →
          </Link>
        </p>
      </section>

      <p className="mt-4 text-center text-xs text-muted">{perfil.email}</p>
      <div className="mt-2">
        <LogoutButton />
      </div>
    </main>
  );
}
