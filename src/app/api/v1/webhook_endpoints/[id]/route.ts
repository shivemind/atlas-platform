import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "../../../../../lib/handler";
import { NotFoundError } from "../../../../../lib/errors";
import { prisma } from "../../../../../lib/prisma";
import { serializeWebhookEndpoint } from "../../../../../lib/serializers";

export const GET = createHandler({
  auth: "merchant",
  handler: async (ctx) => {
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: ctx.params.id, merchantId: ctx.merchantId },
    });
    if (!endpoint) {
      throw new NotFoundError(
        "WEBHOOK_ENDPOINT_NOT_FOUND",
        "Webhook endpoint not found.",
      );
    }
    return NextResponse.json({
      webhook_endpoint: serializeWebhookEndpoint(endpoint, { includeSecret: true }),
    });
  },
});

const updateSchema = z.object({
  url: z.string().url().optional(),
  enabled_events: z.array(z.string().min(1)).min(1).optional(),
  is_active: z.boolean().optional(),
});

export const PATCH = createHandler({
  auth: "merchant",
  validate: updateSchema,
  handler: async (ctx) => {
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: ctx.params.id, merchantId: ctx.merchantId },
    });
    if (!existing) {
      throw new NotFoundError(
        "WEBHOOK_ENDPOINT_NOT_FOUND",
        "Webhook endpoint not found.",
      );
    }

    const data: Record<string, unknown> = {};
    if (ctx.body.url !== undefined) data.url = ctx.body.url;
    if (ctx.body.enabled_events !== undefined) data.eventTypes = ctx.body.enabled_events;
    if (ctx.body.is_active !== undefined) data.isActive = ctx.body.is_active;

    const updated = await prisma.webhookEndpoint.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json({
      webhook_endpoint: serializeWebhookEndpoint(updated, { includeSecret: true }),
    });
  },
});

export const DELETE = createHandler({
  auth: "merchant",
  handler: async (ctx) => {
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: ctx.params.id, merchantId: ctx.merchantId },
    });
    if (!existing) {
      throw new NotFoundError(
        "WEBHOOK_ENDPOINT_NOT_FOUND",
        "Webhook endpoint not found.",
      );
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    return NextResponse.json({
      webhook_endpoint: serializeWebhookEndpoint(updated),
    });
  },
});
