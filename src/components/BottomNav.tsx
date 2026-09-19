"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/",
    etiqueta: "Inicio",
    icono: (
      <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1v-10.5Z" />
    )
  },
  {
    href: "/nutricion",
    etiqueta: "Comida",
    icono: (
      <path d="M7 3v8a3 3 0 0 0 3 3v7M10 3v6M4 3v6M17 3c-2 2-2 6-2 8h3v10" strokeWidth="2" />
    )
  },
  {
    href: "/progreso",
    etiqueta: "Progreso",
    icono: <path d="M4 20V10m5.5 10V4m5.5 16v-8m5.5 8V7" strokeWidth="2.4" />
  },
  {
    href: "/rutina",
    etiqueta: "Rutina",
    icono: (
      <path d="M7 9v6M4 10.5v3M17 9v6m3-4.5v3M8.5 12h7" strokeWidth="2.4" />
    )
  },
  {
    href: "/perfil",
    etiqueta: "Perfil",
    icono: (
      <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 10a8 8 0 0 1 16 0" />
    )
  }
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map((item) => {
          const activo =
            item.href === "/"
              ? pathname === "/" || pathname.startsWith("/dia")
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[60px] flex-col items-center gap-0.5 px-2 py-2 text-xs font-medium ${
                activo ? "text-accent" : "text-muted"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {item.icono}
              </svg>
              {item.etiqueta}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
