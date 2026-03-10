import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "../../../../../lib/handler";
import { BadRequestError } from "../../../../../lib/errors";
import { prisma } from "../../../../../lib/prisma";
import { processWebhookDelivery } from "../../../../../lib/webhooks";

const resendSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const POST = createHandler({
  auth: "merchant",
  validate: resendSchema,
  handler: async (ctx) => {
    const fromDate = new Date(ctx.body.from);
    const toDate = new Date(ctx.body.to);

    if (fromDate >= toDate) {
      throw new BadRequestError(
        "INVALID_TIME_RANGE",
        "\"from\" must be before \"to\".",
      );
    }

    const failedDeliveries = await prisma.webhookDelivery.findMany({
      where: {
        merchantId: ctx.merchantId,
        status: "FAILED",
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: { id: true },
      take: 100,
    });

    const results: Array<{
      delivery_id: string;
      delivered: boolean;
      response_status: number;
    }> = [];

    for (const d of failedDeliveries) {
      const result = await processWebhookDelivery(d.id);
      results.push({
        delivery_id: result.deliveryId,
        delivered: result.delivered,
        response_status: result.responseStatus,
      });
    }

    return NextResponse.json({
      resent: results.length,
      delivered: results.filter((r) => r.delivered).length,
      failed: results.filter((r) => !r.delivered).length,
      results,
    });
  },
});
