import Link from "next/link";
import HiloMensajes from "@/components/HiloMensajes";
import { requireCliente } from "@/lib/auth";
import { getMensajes } from "@/lib/data";

export default async function MensajesPage() {
  const { userId } = await requireCliente();
  const mensajes = await getMensajes(userId, 60);
  return (
    <main>
      <Link href="/" className="text-sm font-medium text-accent">
        ← Inicio
      </Link>
      <h1 className="mb-3 mt-2 text-2xl font-bold">Mensajes</h1>
      <HiloMensajes soyEntrenador={false} inicial={mensajes} />
    </main>
  );
}
