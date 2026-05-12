"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { Prisma } from "@prisma/client";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ForbiddenError, requireAdmin } from "@/lib/permissions";

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;
const TAG_MAX_CHARS = 30;
const TAGS_MAX = 10;

const tagsPipeline = z
  .string()
  .optional()
  .default("")
  .transform((raw) =>
    Array.from(
      new Set(
        raw
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s.length > 0)
      )
    )
  )
  .pipe(
    z
      .array(
        z
          .string()
          .min(1, "Tag cannot be empty")
          .max(TAG_MAX_CHARS, `Each tag must be ≤ ${TAG_MAX_CHARS} characters`)
      )
      .max(TAGS_MAX, `At most ${TAGS_MAX} tags`)
  );

const capacityPipeline = z
  .string()
  .optional()
  .default("")
  .transform((raw) => raw.trim())
  .transform((raw, ctx) => {
    if (raw === "") return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Capacity must be a positive integer, or blank for default"
      });
      return z.NEVER;
    }
    return n;
  });

const projectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(TITLE_MAX, `Title must be ≤ ${TITLE_MAX} characters`),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(DESCRIPTION_MAX, `Description must be ≤ ${DESCRIPTION_MAX} characters`),
  tags: tagsPipeline,
  capacity: capacityPipeline
});

export type ProjectFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<
    Record<"title" | "description" | "tags" | "capacity" | "form", string>
  >;
};

async function assertRegistrationOpen(): Promise<void> {
  const registration = await db.eventPhase.findUnique({
    where: { name: "REGISTRATION" }
  });
  if (!registration || registration.status !== "OPEN") {
    throw new ForbiddenError(
      "Projects are editable only while REGISTRATION is OPEN"
    );
  }
}

function rawFromForm(formData: FormData) {
  return {
    title: (formData.get("title") as string | null) ?? "",
    description: (formData.get("description") as string | null) ?? "",
    tags: (formData.get("tags") as string | null) ?? "",
    capacity: (formData.get("capacity") as string | null) ?? ""
  };
}

function fieldErrorsFromZod(
  err: z.ZodError
): NonNullable<ProjectFormState["fieldErrors"]> {
  const fieldErrors: NonNullable<ProjectFormState["fieldErrors"]> = {};
  for (const issue of err.issues) {
    const key = issue.path[0];
    if (
      (key === "title" ||
        key === "description" ||
        key === "tags" ||
        key === "capacity") &&
      !fieldErrors[key]
    ) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

export async function createProject(
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const user = await requireAdmin();

  try {
    await assertRegistrationOpen();
  } catch (err) {
    return {
      status: "error",
      fieldErrors: {
        form:
          err instanceof ForbiddenError
            ? err.message
            : "Cannot create project right now."
      }
    };
  }

  const parsed = projectSchema.safeParse(rawFromForm(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error)
    };
  }

  const data = parsed.data;
  const project = await db.project.create({
    data: {
      title: data.title,
      description: data.description,
      tags: data.tags,
      capacity: data.capacity
    }
  });

  const details: Prisma.InputJsonValue = {
    title: project.title,
    tags: project.tags,
    capacity: project.capacity
  };

  await logAudit({
    actorId: user.id,
    action: "PROJECT_CREATE",
    target: project.id,
    details
  });

  revalidatePath("/admin/projects");
  redirect("/admin/projects");
}

export async function updateProject(
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const user = await requireAdmin();

  const id = (formData.get("id") as string | null) ?? "";
  if (!id) {
    return {
      status: "error",
      fieldErrors: { form: "Missing project id." }
    };
  }

  try {
    await assertRegistrationOpen();
  } catch (err) {
    return {
      status: "error",
      fieldErrors: {
        form:
          err instanceof ForbiddenError
            ? err.message
            : "Cannot update project right now."
      }
    };
  }

  const existing = await db.project.findUnique({ where: { id } });
  if (!existing) {
    return {
      status: "error",
      fieldErrors: { form: "Project not found." }
    };
  }

  const parsed = projectSchema.safeParse(rawFromForm(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error)
    };
  }

  const data = parsed.data;
  const updated = await db.project.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      tags: data.tags,
      capacity: data.capacity
    }
  });

  const diff: Record<string, { from: unknown; to: unknown }> = {};
  if (existing.title !== updated.title) {
    diff.title = { from: existing.title, to: updated.title };
  }
  if (existing.description !== updated.description) {
    diff.description = {
      from: existing.description,
      to: updated.description
    };
  }
  const tagsChanged =
    existing.tags.length !== updated.tags.length ||
    existing.tags.some((t, i) => t !== updated.tags[i]);
  if (tagsChanged) {
    diff.tags = { from: existing.tags, to: updated.tags };
  }
  if (existing.capacity !== updated.capacity) {
    diff.capacity = { from: existing.capacity, to: updated.capacity };
  }

  await logAudit({
    actorId: user.id,
    action: "PROJECT_UPDATE",
    target: updated.id,
    details: {
      title: updated.title,
      diff
    } as Prisma.InputJsonValue
  });

  revalidatePath("/admin/projects");
  redirect("/admin/projects");
}

export async function deleteProject(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  await assertRegistrationOpen();

  const id = (formData.get("id") as string | null) ?? "";
  if (!id) {
    throw new Error("Missing project id");
  }

  const existing = await db.project.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Project not found");
  }

  await db.project.delete({ where: { id } });

  await logAudit({
    actorId: user.id,
    action: "PROJECT_DELETE",
    target: id,
    details: {
      title: existing.title,
      tags: existing.tags,
      capacity: existing.capacity
    } as Prisma.InputJsonValue
  });

  revalidatePath("/admin/projects");
}
