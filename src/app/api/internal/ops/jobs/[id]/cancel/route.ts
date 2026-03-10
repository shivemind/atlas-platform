import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../../lib/handler";
import { NotFoundError, ConflictError } from "../../../../../../../lib/errors";
import { prisma } from "../../../../../../../lib/prisma";
import { serializeJob } from "../../route";

export const POST = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const job = await prisma.$transaction(async (tx) => {
      const existing = await tx.job.findUnique({
        where: { id: ctx.params.id },
      });
      if (!existing) {
        throw new NotFoundError("JOB_NOT_FOUND", "Job not found.");
      }
      if (existing.status !== "QUEUED" && existing.status !== "RUNNING") {
        throw new ConflictError(
          "INVALID_JOB_STATE",
          "Only queued or running jobs can be canceled.",
        );
      }

      return tx.job.update({
        where: { id: existing.id },
        data: { status: "CANCELED", completedAt: new Date() },
      });
    });

    return NextResponse.json({ job: serializeJob(job) });
  },
});
