/**
 * Public API for the matching engine.
 *
 * Pure TypeScript — framework-agnostic, no Prisma imports. Callers (e.g. the
 * Phase 7 API route) translate domain entities into the plain shapes defined
 * in `./types` and persist the results.
 */

export { hospitalResidents } from "./hospital-residents";
export { completeMatch } from "./complete-match";
export { assignProjects } from "./project-assignment";
export { autoFillPreferences } from "./auto-fill";
export { seededRng, shuffle, sample } from "./rng";

export type {
  Resident,
  Hospital,
  HRInput,
  HRResult,
  CompletedHRResult,
  PodHeadForProjects,
  ProjectInput,
  ProjectAssignmentInput,
  ProjectAssignmentResult,
  MatchType,
  Rng,
  AutoFillRow,
  AutoFillInput,
  AutoFillResult
} from "./types";
