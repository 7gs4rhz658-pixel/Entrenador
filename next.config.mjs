/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // Las fotos de progreso se suben por server action (ya comprimidas en
  // el teléfono a ~300 KB, pero con margen).
  experimental: {
    serverActions: { bodySizeLimit: "6mb" }
  },
  // El lector de PDF (planes del entrenador) va tal cual desde node_modules
  serverExternalPackages: ["unpdf"]
};

export default nextConfig;
