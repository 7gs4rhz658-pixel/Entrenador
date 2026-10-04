"use client";

import PantallaError from "@/components/PantallaError";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PantallaError {...props} inicio="/entrenador" />;
}
