"use client";

import { startTransition, useActionState, type FormEvent } from "react";

// useActionState para formularios, sin el reseteo automático de React 19
// (con `<form action>` los campos se vacían al terminar, aunque la acción
// devuelva un error y haya que corregir un dato). Devuelve el estado, el
// onSubmit del formulario y si está enviando.
export function useFormulario<E extends object>(accion: (prev: E, datos: FormData) => Promise<E>, inicial: E) {
  const [estado, despachar, pendiente] = useActionState<E, FormData>(
    accion as (prev: Awaited<E>, datos: FormData) => Promise<E>,
    inicial as Awaited<E>
  );
  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const boton = (e.nativeEvent as SubmitEvent).submitter;
    const datos = new FormData(e.currentTarget, boton instanceof HTMLButtonElement ? boton : null);
    startTransition(() => despachar(datos));
  }
  return [estado, enviar, pendiente] as const;
}
