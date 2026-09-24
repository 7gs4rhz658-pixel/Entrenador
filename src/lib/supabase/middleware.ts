import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { usuarioDeSesion } from "./usuario";

// Refresca el token de Supabase en cada request y devuelve el usuario.
// Patrón oficial de @supabase/ssr para Next.js App Router.
export async function actualizarSesion(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { res, user: null };

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(lista) {
        for (const { name, value } of lista) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of lista) {
          res.cookies.set(name, value, options);
        }
      }
    }
  });

  const user = await usuarioDeSesion(supabase);
  return { res, user };
}
