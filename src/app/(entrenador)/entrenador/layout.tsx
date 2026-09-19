import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { requireEntrenador } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function EntrenadorLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { perfil } = await requireEntrenador();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-5">
      <header className="mb-5 flex items-center justify-between gap-3">
        <Link href="/entrenador" className="text-lg font-bold">
          🏋️ Panel de entrenador
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted sm:inline">{perfil.nombre || perfil.email}</span>
          <div className="w-auto">
            <LogoutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
