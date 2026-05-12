/**
 * GET /api/my-assignment
 *
 * Returns the signed-in user's role-shaped assignment + transparency data
 * (SRS §8.5). Gated to RESULTS_PUBLISHED OPEN; admins bypass.
 *
 *   200 → { role, results }
 *   401 → not signed in
 *   403 → results not yet published
 */

import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  getAgentResults,
  getOrchResults,
  getPodHeadResults
} from "@/lib/results";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const user = session.user;
  if (!user.isAdmin) {
    const phase = await db.eventPhase.findUnique({
      where: { name: "RESULTS_PUBLISHED" }
    });
    if (phase?.status !== "OPEN") {
      return NextResponse.json(
        { error: "Results not yet published." },
        { status: 403 }
      );
    }
  }

  const role: Role = user.role;
  switch (role) {
    case "AGENT": {
      const results = await getAgentResults(user.id);
      return NextResponse.json({ role, results });
    }
    case "POD_HEAD": {
      const results = await getPodHeadResults(user.id);
      return NextResponse.json({ role, results });
    }
    case "ORCH": {
      const results = await getOrchResults(user.id);
      return NextResponse.json({ role, results });
    }
  }
}
