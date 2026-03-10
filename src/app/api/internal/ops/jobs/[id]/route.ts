import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../lib/errors";
import { prisma } from "../../../../../../lib/prisma";
import { serializeJob } from "../route";

export const GET = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const job = await prisma.job.findUnique({
      where: { id: ctx.params.id },
    });
    if (!job) {
      throw new NotFoundError("JOB_NOT_FOUND", "Job not found.");
    }

    return NextResponse.json({ job: serializeJob(job) });
  },
});

const updateSchema = z.object({
  status: z.enum(["queued", "running", "completed", "failed", "canceled"]),
  result: z.record(z.string(), z.unknown()).optional(),
  error_message: z.string().max(2000).optional(),
});

export const PATCH = createHandler({
  auth: "admin",
  validate: updateSchema,
  handler: async (ctx) => {
    const job = await prisma.$transaction(async (tx) => {
      const existing = await tx.job.findUnique({
        where: { id: ctx.params.id },
      });
      if (!existing) {
        throw new NotFoundError("JOB_NOT_FOUND", "Job not found.");
      }

      const now = new Date();
      const data: Record<string, unknown> = {
        status: ctx.body.status.toUpperCase(),
      };
      if (ctx.body.result !== undefined) data.result = ctx.body.result;
      if (ctx.body.error_message !== undefined)
        data.errorMessage = ctx.body.error_message;
      if (ctx.body.status === "running" && !existing.startedAt) {
        data.startedAt = now;
        data.attempts = existing.attempts + 1;
      }
      if (ctx.body.status === "completed" || ctx.body.status === "failed") {
        data.completedAt = now;
      }

      return tx.job.update({ where: { id: existing.id }, data });
    });

    return NextResponse.json({ job: serializeJob(job) });
  },
});
