"use client";

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
          !window.confirm(
            `Delete project "${title}"? This cannot be undone.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-900 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100 dark:hover:bg-rose-900"
      >
        Delete
      </button>
    </form>
  );
}
