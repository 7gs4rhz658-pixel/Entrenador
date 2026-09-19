import Link from "next/link";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mb-3 text-4xl">🏋️</div>
        <h1 className="text-2xl font-bold">Mi Entrenador Personal</h1>
        <p className="mt-1 text-muted">Ingresá con tu correo para ver tu plan</p>
      </div>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-muted">
        ¿Todavía no tenés cuenta?{" "}
        <Link href="/registro" className="font-semibold text-accent">
          Empezá acá
        </Link>
      </p>
    </main>
  );
}
