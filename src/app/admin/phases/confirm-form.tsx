"use client";

import { useRef } from "react";

export function ConfirmForm({
  action,
  phase,
  confirmMessage,
  children
}: {
  action: (formData: FormData) => void | Promise<void>;
  phase: string;
  confirmMessage?: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="phase" value={phase} />
      {children}
    </form>
  );
}
