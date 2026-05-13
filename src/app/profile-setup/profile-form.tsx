"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  saveProfile,
  type ProfileFormState
} from "./actions";

interface Props {
  initial: {
    bio: string;
    skills: string;
    pitch: string;
  };
  showSkills: boolean;
  pitchMin: number;
  pitchMax: number;
}

const initialState: ProfileFormState = { ok: false };

export function ProfileForm({ initial, showSkills, pitchMin, pitchMax }: Props) {
  const [state, formAction, pending] = useActionState(saveProfile, initialState);

  const values = state.values ?? initial;
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="bio">Bio</Label>
        <p className="mt-1 text-xs text-fg-muted">
          A short description of you. Up to 2000 characters.
        </p>
        <Textarea
          id="bio"
          name="bio"
          rows={4}
          defaultValue={values.bio}
          maxLength={2000}
          className="mt-2"
        />
        {errors.bio ? (
          <p className="mt-1 text-xs text-red-600">{errors.bio}</p>
        ) : null}
      </div>

      {showSkills ? (
        <div>
          <Label htmlFor="skills">Skills</Label>
          <p className="mt-1 text-xs text-fg-muted">
            Comma-separated. Up to 20 skills, 1–30 characters each.
          </p>
          <Input
            id="skills"
            name="skills"
            type="text"
            defaultValue={values.skills}
            className="mt-2"
            placeholder="TypeScript, React, Postgres"
          />
          {errors.skills ? (
            <p className="mt-1 text-xs text-red-600">{errors.skills}</p>
          ) : null}
        </div>
      ) : (
        <input type="hidden" name="skills" value="" />
      )}

      <div>
        <Label htmlFor="pitch">
          Pitch <span className="text-red-600">*</span>
        </Label>
        <p className="mt-1 text-xs text-fg-muted">
          What makes you a great teammate? {pitchMin}–{pitchMax} characters.
        </p>
        <Textarea
          id="pitch"
          name="pitch"
          rows={6}
          required
          minLength={pitchMin}
          maxLength={pitchMax}
          defaultValue={values.pitch}
          className="mt-2"
        />
        {errors.pitch ? (
          <p className="mt-1 text-xs text-red-600">{errors.pitch}</p>
        ) : null}
      </div>

      {errors.form ? <Alert variant="danger">{errors.form}</Alert> : null}

      <div className="flex items-center justify-end">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
