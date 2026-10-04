import Link from "next/link";

export const metadata = { title: "Aviso de privacidad · Mi Entrenador Personal" };

// Aviso de privacidad integral (LFPDPPP, México). Los datos del
// responsable se cargan en Vercel (AVISO_RESPONSABLE, AVISO_DOMICILIO,
// AVISO_CONTACTO) para no tocar código. Es una base: conviene que la revise
// un abogado.
export default function PrivacidadPage() {
  const responsable = process.env.AVISO_RESPONSABLE?.trim() || "tu entrenador personal (responsable de esta app)";
  const domicilio = process.env.AVISO_DOMICILIO?.trim();
  const correo = process.env.AVISO_CONTACTO?.trim();
  const contacto = correo ? `a ${correo}` : "por el chat de Mensajes de la app";

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 text-sm leading-relaxed">
      <h1 className="mb-1 text-2xl font-bold">Aviso de privacidad</h1>
      <p className="mb-6 text-muted">Mi Entrenador Personal · última actualización: octubre de 2026</p>

      <Seccion titulo="Quién es responsable de tus datos">
        <p>
          El responsable del tratamiento de tus datos personales es {responsable}
          {domicilio ? `, con domicilio en ${domicilio}` : ""}. Para cualquier tema de privacidad
          escríbele {contacto}.
        </p>
      </Seccion>

      <Seccion titulo="Qué datos guardamos">
        <ul className="list-disc pl-5">
          <li>De identificación y contacto: nombre y correo.</li>
          <li>
            <strong>Datos sensibles de salud</strong>: edad, sexo, peso, estatura, medidas corporales,
            fotos de progreso, lesiones, alergias y alimentos que no comes.
          </li>
          <li>
            Lo que registras en la app: entrenamientos (series, pesos, repeticiones), comidas, check-ins,
            hábitos del protocolo y mensajes con tu entrenador.
          </li>
          <li>Datos técnicos: el permiso de notificaciones de tu teléfono, si lo activas.</li>
        </ul>
        <p className="mt-2">La app no pide ni guarda datos de tarjetas: el pago se hace directo con tu entrenador.</p>
      </Seccion>

      <Seccion titulo="Para qué los usamos">
        <ul className="list-disc pl-5">
          <li>Armar y ajustar tu rutina, tu recomendación de comidas y tu protocolo.</li>
          <li>Que tu entrenador vea tu avance, te escriba y prepare tus informes semanales.</li>
          <li>Mandarte avisos y recordatorios si los activas.</li>
          <li>Llevar el control de tu pago mensual.</li>
        </ul>
        <p className="mt-2">No usamos tus datos para publicidad ni los vendemos.</p>
      </Seccion>

      <Seccion titulo="Quién más los procesa">
        <p>
          Solo tu entrenador ve tu información. Para que la app funcione, estos proveedores la procesan por
          cuenta nuestra, con sus propias medidas de seguridad y en servidores que pueden estar fuera de
          México:
        </p>
        <ul className="mt-2 list-disc pl-5">
          <li>Supabase: base de datos, inicio de sesión y almacenamiento de fotos.</li>
          <li>Vercel: servidor donde corre la app.</li>
          <li>
            Groq: inteligencia artificial que ayuda a redactar recomendaciones e informes. Recibe solo la
            información necesaria para cada texto (por ejemplo, tus macros o tu pregunta), sin tu correo.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Tu consentimiento">
        <p>
          Al crear tu cuenta aceptas expresamente que tratemos tus datos sensibles de salud para las
          finalidades de arriba. Puedes retirar tu consentimiento cuando quieras eliminando tu cuenta.
        </p>
      </Seccion>

      <Seccion titulo="Tus derechos (ARCO)">
        <p>
          Puedes pedir acceso a tus datos, corregirlos, cancelarlos u oponerte a su uso. Casi todo lo
          puedes hacer tú mismo en Perfil: editar tus datos o <strong>eliminar tu cuenta</strong>, que borra
          de forma definitiva tus datos y tus fotos. Para cualquier otra solicitud escribe {contacto}; te
          responderemos en un máximo de 20 días hábiles.
        </p>
      </Seccion>

      <Seccion titulo="Cambios a este aviso">
        <p>Si este aviso cambia, te lo mostraremos dentro de la app para que lo vuelvas a aceptar.</p>
      </Seccion>

      <Link href="/" className="btn-ghost mt-6 w-full">
        Volver
      </Link>
    </main>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-1.5 font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}
