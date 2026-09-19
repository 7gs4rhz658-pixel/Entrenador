"use client";

import { useTransition } from "react";
import { logout } from "@/app/actions/auth";

export default function LogoutButton() {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      onClick={() => iniciar(async () => logout())}
      disabled={pendiente}
      className="btn-ghost w-full"
    >
      Cerrar sesión
    </button>
  );
}
