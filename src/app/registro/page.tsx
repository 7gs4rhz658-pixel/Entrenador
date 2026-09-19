import Link from "next/link";
import RegistroForm from "@/components/RegistroForm";

export default function RegistroPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mb-3 text-4xl">💪</div>
        <h1 className="text-2xl font-bold">Creá tu cuenta</h1>
        <p className="mt-1 text-muted">
          Después te hacemos unas preguntas y armamos tu plan.
        </p>
      </div>
      <RegistroForm />
      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-semibold text-accent">
          Iniciá sesión
        </Link>
      </p>
    </main>
  );
}
