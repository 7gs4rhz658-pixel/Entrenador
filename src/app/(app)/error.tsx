"use client";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="card mt-10 text-center">
      <p className="text-lg font-semibold">✗ Algo salió mal</p>
      <p className="mt-2 break-words text-sm text-muted">{error.message}</p>
      <button onClick={reset} className="btn-primary mt-4">
        Reintentar
      </button>
    </main>
  );
}
