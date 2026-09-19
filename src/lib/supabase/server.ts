import { createServerClient } from "@supabase/ssr";
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

export const db = cache(() => {
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
