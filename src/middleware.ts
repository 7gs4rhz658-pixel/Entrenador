import { NextResponse, type NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/supabase/middleware";

const PUBLICAS = ["/login", "/registro", "/confirmar", "/privacidad"];

export async function middleware(req: NextRequest) {
  const { res, user } = await actualizarSesion(req);
  const { pathname } = req.nextUrl;
  const esPublica = PUBLICAS.some((p) => pathname.startsWith(p));

  if (!user && !esPublica) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && (pathname.startsWith("/login") || pathname.startsWith("/registro"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  // Protege todo salvo estáticos de Next, íconos, el service worker y el
  // cron de avisos (que se autentica con CRON_SECRET, sin usuario)
  matcher: [
    "/((?!_next/static|_next/image|favicon\.ico|icon\.svg|manifest\.webmanifest|sw\.js|api/cron).*)"
  ]
};
