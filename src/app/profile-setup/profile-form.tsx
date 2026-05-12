"use client";

import { useActionState } from "react";
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
    <form action={formAction} className="mt-8 space-y-6">
      <div>
        <label className="block text-sm font-medium" htmlFor="bio">
          Bio
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          A short description of you. Up to 2000 characters.
        </p>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          defaultValue={values.bio}
          maxLength={2000}
          className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors.bio ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errors.bio}
          </p>
        ) : null}
      </div>

      {showSkills ? (
        <div>
          <label className="block text-sm font-medium" htmlFor="skills">
            Skills
          </label>
          <p className="mt-1 text-xs text-zinc-500">
            Comma-separated. Up to 20 skills, 1–30 characters each.
          </p>
          <input
            id="skills"
            name="skills"
            type="text"
            defaultValue={values.skills}
            className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="TypeScript, React, Postgres"
          />
          {errors.skills ? (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.skills}
            </p>
          ) : null}
        </div>
      ) : (
        <input type="hidden" name="skills" value="" />
      )}

      <div>
        <label className="block text-sm font-medium" htmlFor="pitch">
          Pitch <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          What makes you a great teammate? {pitchMin}–{pitchMax} characters.
        </p>
        <textarea
          id="pitch"
          name="pitch"
          rows={6}
          required
          minLength={pitchMin}
          maxLength={pitchMax}
          defaultValue={values.pitch}
          className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors.pitch ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errors.pitch}
          </p>
        ) : null}
      </div>

      {errors.form ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {errors.form}
        </div>
      ) : null}

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
