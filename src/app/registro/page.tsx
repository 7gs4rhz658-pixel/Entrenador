import Link from "next/link";
import RegistroForm from "@/components/RegistroForm";

export default async function RegistroPage(props: { searchParams: Promise<{ ref?: string }> }) {
  const searchParams = await props.searchParams;
  const referido = String(searchParams?.ref ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mb-3 text-4xl">💪</div>
        <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
        <p className="mt-1 text-muted">
          Después te hacemos unas preguntas y armamos tu plan.
        </p>
      </div>
      <RegistroForm referido={referido} />
      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-accent">
          Inicia sesión
        </Link>
      </p>
    </main>
  );
}
