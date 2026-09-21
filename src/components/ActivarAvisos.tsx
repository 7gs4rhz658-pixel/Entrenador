"use client";

import { useEffect, useState } from "react";
import { borrarSuscripcionPush, guardarSuscripcionPush } from "@/app/actions/push";

function base64ToUint8(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Estado = "cargando" | "no_soportado" | "bloqueado" | "apagado" | "activo";

// Avisos al teléfono: "mañana te toca", check-in pendiente, mensajes del
// entrenador y vencimiento del mes. En iPhone hace falta instalar la app
// en la pantalla de inicio primero.
export default function ActivarAvisos({ vapidKey, entrenador = false }: { vapidKey: string | null; entrenador?: boolean }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return setEstado("no_soportado");
    if (Notification.permission === "denied") return setEstado("bloqueado");
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((s) => setEstado(s ? "activo" : "apagado"))
      .catch(() => setEstado("apagado"));
  }, [vapidKey]);

  async function activar() {
    if (!vapidKey) return;
    setOcupado(true);
    setError(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "apagado");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8(vapidKey) });
      const json = sub.toJSON();
      const r = await guardarSuscripcionPush({ endpoint: sub.endpoint, keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth } });
      if (r.error) throw new Error(r.error);
      setEstado("activo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar.");
    } finally {
      setOcupado(false);
    }
  }

  async function desactivar() {
    setOcupado(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await borrarSuscripcionPush({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setEstado("apagado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo desactivar.");
    } finally {
      setOcupado(false);
    }
  }

  const esIOS = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);
  const instalada = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;

  return (
    <section className="card mt-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold">Avisos en el teléfono</p>
          <p className="mt-0.5 text-muted">
            {entrenador
              ? "Clientes nuevos por armar, check-ins e informes por aprobar y mensajes de tus clientes."
              : "Qué te toca mañana, check-in pendiente, mensajes de tu entrenador y tu renovación."}
          </p>
        </div>
        {estado === "activo" ? (
          <button type="button" onClick={desactivar} disabled={ocupado} className="chip shrink-0 border-ok/40 text-ok">
            ✓ activos
          </button>
        ) : estado === "apagado" ? (
          <button type="button" onClick={activar} disabled={ocupado} className="btn-primary shrink-0 px-3 py-1.5 text-sm">
            {ocupado ? "…" : "Activar"}
          </button>
        ) : null}
      </div>
      {estado === "no_soportado" ? (
        <p className="mt-2 text-xs text-muted">
          {!vapidKey
            ? "Los avisos no están configurados en este servidor."
            : esIOS && !instalada
              ? "En iPhone: tocá Compartir → \"Agregar a inicio\" y abrí la app desde ahí para poder activar los avisos."
              : "Este navegador no soporta avisos."}
        </p>
      ) : null}
      {estado === "bloqueado" ? (
        <p className="mt-2 text-xs text-warn">Los avisos están bloqueados en el navegador: habilitalos en la configuración del sitio.</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-danger">✗ {error}</p> : null}
    </section>
  );
}
