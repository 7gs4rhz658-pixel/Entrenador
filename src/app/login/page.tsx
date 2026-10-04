import Link from "next/link";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mb-3 text-4xl">🏋️</div>
        <h1 className="text-2xl font-bold">Mi Entrenador Personal</h1>
        <p className="mt-1 text-muted">Entra con tu correo para ver tu plan</p>
      </div>
      <LoginForm />
      <details className="mt-4 text-center text-sm text-muted">
        <summary className="cursor-pointer select-none font-semibold text-accent">¿Olvidaste tu contraseña?</summary>
        <p className="mt-2">
          Escríbele a tu entrenador: te da una contraseña temporal y, al entrar, la app te pide crear una nueva.
        </p>
      </details>
      <p className="mt-6 text-center text-sm text-muted">
        ¿Todavía no tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-accent">
          Empieza aquí
        </Link>
      </p>
    </main>
  );
}
