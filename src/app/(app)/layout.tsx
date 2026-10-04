import AceptarPrivacidad from "@/components/AceptarPrivacidad";
import BottomNav from "@/components/BottomNav";
import RegistrarSW from "@/components/RegistrarSW";
import { requireCliente } from "@/lib/auth";

// Todo el árbol autenticado se renderiza en cada request (los datos
// viven en Supabase y se editan desde el teléfono).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { perfil } = await requireCliente();
  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-5">
      <RegistrarSW />
      {perfil.acepto_privacidad_at ? null : <AceptarPrivacidad />}
      {children}
      <BottomNav />
    </div>
  );
}
