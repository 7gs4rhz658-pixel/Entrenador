import Link from "next/link";

export default function ConfirmarPage({
  searchParams
}: {
  searchParams?: { email?: string };
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="card text-center">
        <div className="mb-3 text-4xl">📬</div>
        <h1 className="text-xl font-bold">Confirma tu correo</h1>
        <p className="mt-2 text-sm text-muted">
          Te mandamos un enlace a{" "}
          <span className="font-semibold text-ink">{searchParams?.email ?? "tu correo"}</span>.
          Tócalo y después inicia sesión para seguir con el cuestionario.
        </p>
        <Link href="/login" className="btn-primary mt-5 w-full">
          Ir a iniciar sesión
        </Link>
      </div>
    </main>
  );
}
