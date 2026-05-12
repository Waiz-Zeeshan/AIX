"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAuth } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";

export interface ProfileFormState {
  ok: boolean;
  errors?: {
    bio?: string;
    skills?: string;
    pitch?: string;
    form?: string;
  };
  values?: {
    bio: string;
    skills: string;
    pitch: string;
  };
}

const BIO_MAX = 2000;
const SKILLS_MAX = 20;
const SKILL_MIN = 1;
const SKILL_MAX = 30;

function parseSkills(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const s = part.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function landingFor(user: {
  isAdmin: boolean;
  role: "AGENT" | "POD_HEAD" | "ORCH";
}): string {
  if (user.isAdmin) return "/admin";
  if (user.role === "ORCH") return "/orch";
  if (user.role === "POD_HEAD") return "/pod-head";
  return "/agent";
}

export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const user = await requireAuth();
  const config = await getConfig();

  const bio = String(formData.get("bio") ?? "").trim();
  const skillsRaw = String(formData.get("skills") ?? "");
  const pitch = String(formData.get("pitch") ?? "").trim();
  const skills = parseSkills(skillsRaw);

  const includesSkills = user.role !== "ORCH";

  const schema = z.object({
    bio: z.string().max(BIO_MAX, `Bio must be ${BIO_MAX} characters or fewer`),
    skills: z
      .array(
        z
          .string()
          .min(SKILL_MIN, "Each skill must be at least 1 character")
          .max(SKILL_MAX, `Each skill must be ${SKILL_MAX} characters or fewer`)
      )
      .max(SKILLS_MAX, `At most ${SKILLS_MAX} skills`),
    pitch: z
      .string()
      .min(
        config.pitchMinChars,
        `Pitch must be at least ${config.pitchMinChars} characters`
      )
      .max(
        config.pitchMaxChars,
        `Pitch must be ${config.pitchMaxChars} characters or fewer`
      )
  });

  const parsed = schema.safeParse({
    bio,
    skills: includesSkills ? skills : [],
    pitch
  });

  const values = { bio, skills: skillsRaw, pitch };

  if (!parsed.success) {
    const errors: ProfileFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "bio" && !errors.bio) errors.bio = issue.message;
      else if (key === "skills" && !errors.skills) errors.skills = issue.message;
      else if (key === "pitch" && !errors.pitch) errors.pitch = issue.message;
    }
    return { ok: false, errors, values };
  }

  const data = parsed.data;
  const now = new Date();

  try {
    await db.$transaction(async (tx) => {
      if (user.role === "ORCH") {
        await tx.orchProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id, bio: data.bio || null, pitch: data.pitch },
          update: { bio: data.bio || null, pitch: data.pitch }
        });
      } else if (user.role === "POD_HEAD") {
        await tx.podHeadProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            bio: data.bio || null,
            skills: data.skills,
            pitch: data.pitch
          },
          update: {
            bio: data.bio || null,
            skills: data.skills,
            pitch: data.pitch
          }
        });
      } else {
        await tx.agentProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            bio: data.bio || null,
            skills: data.skills,
            pitch: data.pitch
          },
          update: {
            bio: data.bio || null,
            skills: data.skills,
            pitch: data.pitch
          }
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: { profileCompletedAt: now }
      });
    });
  } catch {
    return {
      ok: false,
      errors: { form: "Could not save your profile. Try again." },
      values
    };
  }

  redirect(landingFor(user));
}
