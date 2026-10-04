import Link from "next/link";

export default function NoEncontrada() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
      <div className="card text-center">
        <p className="text-4xl">🧭</p>
        <p className="mt-2 text-lg font-semibold">Esta página no existe</p>
        <p className="mt-1 text-sm text-muted">Puede que el enlace esté mal o que ya no esté disponible.</p>
        <Link href="/" className="btn-primary mt-4 w-full">
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
