/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  // Las fotos de progreso se suben por server action (ya comprimidas en
  // el teléfono a ~300 KB, pero con margen).
  experimental: {
    serverActions: { bodySizeLimit: "6mb" }
  },
  // El lector de PDF (planes del entrenador) va tal cual desde node_modules
  serverExternalPackages: ["unpdf"],
  // Cabeceras de seguridad: no se puede incrustar en otra página, el
  // navegador no adivina tipos y no se filtra la URL completa a terceros.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" }
        ]
      }
    ];
  }
};

export default nextConfig;
