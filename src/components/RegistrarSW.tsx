"use client";

import { useEffect } from "react";

// Registra el service worker (necesario para las notificaciones push).
export default function RegistrarSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
