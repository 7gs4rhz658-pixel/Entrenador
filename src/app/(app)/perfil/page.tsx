import Link from "next/link";
import ActivarAvisos from "@/components/ActivarAvisos";
import LogoutButton from "@/components/LogoutButton";
import ProfileForm from "@/components/ProfileForm";
import { requireCliente } from "@/lib/auth";
import CodigoReferido from "@/components/CodigoReferido";
import { getBloque, getProtocolo } from "@/lib/data";

export default async function PerfilPage() {
  const { userId, perfil } = await requireCliente();
  const [meso, protocolo] = await Promise.all([getBloque(userId), getProtocolo(userId)]);

  return (
    <main>
      <h1 className="mb-1 text-2xl font-bold">Perfil</h1>
      <p className="mb-4 text-sm text-muted">
        Si actualizas tu peso u objetivo, las calorías y los macros se
        recalculan solos.
      </p>

      <ProfileForm perfil={perfil} />

      {meso ? (
        <section className="card mt-4 text-sm">
          <p className="font-semibold">Bloque actual</p>
          <p className="mt-1 text-muted">
            {meso.nombre} · Semana {meso.semana_actual} de {meso.total_semanas} ·{" "}
            {meso.estado === "activo" ? "en curso" : "finalizado"} · inicio{" "}
            {new Date(`${meso.fecha_inicio}T12:00:00`).toLocaleDateString("es-MX")}
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

      <section className="card mt-4 text-sm">
        <p className="font-semibold">Cómo comes</p>
        <p className="mt-1 text-muted">
          Comidas por día, horarios, alergias y si cocinas en tandas. Con esto se arma tu
          recomendación de comidas.{" "}
          <Link href="/cuestionario/comida" className="font-semibold text-accent">
            Editar →
          </Link>
        </p>
      </section>

      {protocolo ? (
        <section className="card mt-4 text-sm">
          <p className="font-semibold">Tu protocolo</p>
          <p className="mt-1 text-muted">
            {protocolo.protocolo.nombre}: todo lo que te indicó tu entrenador, por segmento.{" "}
            <Link href="/protocolo" className="font-semibold text-accent">
              Ver →
            </Link>
          </p>
        </section>
      ) : null}

      <ActivarAvisos vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />

      <section className="card mt-4 text-sm">
        <p className="font-semibold">Mensajes</p>
        <p className="mt-1 text-muted">
          Habla con tu entrenador dentro de la app.{" "}
          <Link href="/mensajes" className="font-semibold text-accent">
            Abrir →
          </Link>
        </p>
      </section>

      {perfil.codigo_referido ? <CodigoReferido codigo={perfil.codigo_referido} /> : null}

      <p className="mt-4 text-center text-xs text-muted">{perfil.email}</p>
      <div className="mt-2">
        <LogoutButton />
      </div>
    </main>
  );
}
