"use client";

import "./globals.css";
import PantallaError from "@/components/PantallaError";

// Último recurso: falla el layout raíz. Reemplaza toda la página, así que
// trae su propio <html>.
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body className="min-h-dvh px-4 antialiased">
        <PantallaError {...props} />
      </body>
    </html>
  );
}
