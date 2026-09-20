import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { cache } from "react";

// Cliente de Supabase para server components y server actions. Usa la
// clave pública (anon) + la sesión del usuario que viaja en cookies, así
// que Row Level Security decide qué filas puede ver o tocar cada uno.
function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Configuralas en .env.local (local) o en Vercel (producción)."
    );
  }
  return { url, key };
}

const dbSesion = cache(() => {
  const { url, key } = config();
  const store = cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(lista) {
        // En server components las cookies son de solo lectura; el
        // middleware ya refresca la sesión, así que ignorar acá es seguro.
        try {
          for (const { name, value, options } of lista) {
            store.set(name, value, options);
          }
        } catch {}
      }
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" })
    }
  });
});

// El cron de avisos corre sin usuario: dentro de `conAdmin` todo el
// código de datos usa la clave service_role (salta RLS). Solo el
// servidor la conoce y solo la ruta del cron la usa.
const alsAdmin = new AsyncLocalStorage<SupabaseClient>();

export function adminDisponible(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function conAdmin<T>(fn: () => Promise<T>): Promise<T> {
  const { url } = config();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para las tareas programadas.");
  const cliente = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) }
  });
  return alsAdmin.run(cliente, fn);
}

export function db() {
  return (alsAdmin.getStore() ?? dbSesion()) as ReturnType<typeof dbSesion>;
}
