/**
 * One-off: run all 3 matching passes against the seeded DB and finalize each.
 * Used by the Phase 8 smoke test to populate assignments before verifying
 * the results UI.
 *
 * Usage: tsx scripts/finalize-all.ts
 */

import {
  finalizeMatch,
  runOrchPodHeadMatch,
  runPodHeadAgentMatch,
  runProjectAssignment
} from "../src/lib/matching-service";

const actor = "smoke-test";

async function main() {
  console.log("Run 1: ORCH_PODHEAD…");
  await runOrchPodHeadMatch(actor);
  await finalizeMatch(actor, "ORCH_PODHEAD");

  console.log("Run 2: PODHEAD_AGENT…");
  await runPodHeadAgentMatch(actor);
  await finalizeMatch(actor, "PODHEAD_AGENT");

  console.log("Run 3: PROJECT_ASSIGNMENT…");
  await runProjectAssignment(actor);
  await finalizeMatch(actor, "PROJECT_ASSIGNMENT");

  console.log("✓ All three finalized.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
