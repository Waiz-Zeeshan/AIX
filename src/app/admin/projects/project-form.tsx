"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { ProjectFormState } from "./actions";

export type ProjectFormDefaults = {
  id?: string;
  title: string;
  description: string;
  tags: string[];
  capacity: number | null;
};

const initialState: ProjectFormState = { status: "idle" };

export function ProjectForm({
  action,
  defaults,
  submitLabel,
  defaultCapacityHint
}: {
  action: (
    prev: ProjectFormState,
    formData: FormData
  ) => Promise<ProjectFormState>;
  defaults: ProjectFormDefaults;
  submitLabel: string;
  defaultCapacityHint: number;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      {state.status === "error" && state.fieldErrors?.form && (
        <Alert variant="danger">{state.fieldErrors.form}</Alert>
      )}
      {state.status === "error" && state.message && !state.fieldErrors?.form && (
        <Alert variant="danger">{state.message}</Alert>
      )}

      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          type="text"
          id="title"
          name="title"
          defaultValue={defaults.title}
          maxLength={200}
          required
          className="mt-1"
        />
        {state.fieldErrors?.title && (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.title}</p>
        )}
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaults.description}
          maxLength={2000}
          rows={5}
          required
          className="mt-1"
        />
        {state.fieldErrors?.description && (
          <p className="mt-1 text-xs text-red-600">
            {state.fieldErrors.description}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="tags">Tags</Label>
        <p className="mt-1 text-xs text-fg-muted">
          Comma-separated. Lowercased and deduped. Up to 10, each ≤ 30
          characters.
        </p>
        <Input
          type="text"
          id="tags"
          name="tags"
          defaultValue={defaults.tags.join(", ")}
          className="mt-2"
        />
        {state.fieldErrors?.tags && (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.tags}</p>
        )}
      </div>

      <div>
        <Label htmlFor="capacity">Capacity</Label>
        <p className="mt-1 text-xs text-fg-muted">
          Optional positive integer. Leave blank to use the event default (
          {defaultCapacityHint}).
        </p>
        <Input
          type="number"
          id="capacity"
          name="capacity"
          defaultValue={defaults.capacity ?? ""}
          min={1}
          step={1}
          className="mt-2 w-32"
        />
        {state.fieldErrors?.capacity && (
          <p className="mt-1 text-xs text-red-600">
            {state.fieldErrors.capacity}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-border-default pt-6">
        <SubmitButton label={submitLabel} />
        <Link
          href="/admin/projects"
          className="text-sm text-fg-muted hover:text-fg"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="accent">
      {pending ? "Saving…" : label}
    </Button>
  );
}
