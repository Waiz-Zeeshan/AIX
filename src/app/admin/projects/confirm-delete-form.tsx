"use client";

import { Button } from "@/components/ui/button";

export function ConfirmDeleteForm({
  action,
  id,
  title
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  title: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(`Delete project "${title}"? This cannot be undone.`)
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="danger" size="sm">
        Delete
      </Button>
    </form>
  );
}
