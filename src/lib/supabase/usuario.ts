import { isAuthRetryableFetchError, type SupabaseClient, type User } from "@supabase/supabase-js";

// El usuario de la sesión. Si lo que falla es la red (no la sesión), se
// reintenta una vez: sin esto, un corte de un instante entre el servidor y
// Supabase manda al login a alguien que está logueado.
export async function usuarioDeSesion(supabase: Pick<SupabaseClient, "auth">): Promise<User | null> {
  for (let intento = 0; ; intento++) {
    const { data, error } = await supabase.auth.getUser();
    if (data.user || !isAuthRetryableFetchError(error) || intento >= 1) return data.user ?? null;
    console.warn(`Supabase Auth no respondió (${error.message}); reintentando.`);
    await new Promise((r) => setTimeout(r, 400));
  }
}
