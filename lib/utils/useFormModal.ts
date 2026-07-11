"use client";

import { useRef, useState, type FormEvent } from "react";
import type { ActionResult } from "@/lib/actions/athletes";

export function useFormModal(action: (formData: FormData) => Promise<ActionResult>) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await action(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    formRef.current?.reset();
    setOpen(false);
  }

  return { open, setOpen, pending, error, formRef, handleSubmit };
}
