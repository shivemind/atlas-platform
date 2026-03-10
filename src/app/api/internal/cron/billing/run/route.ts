import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";

import { createHandler } from "../../../../../../lib/handler";
import { prisma } from "../../../../../../lib/prisma";
import { emitDomainEvent } from "../../../../../../lib/events";

const LOCK_KEY = "cron:billing:lock";
const hasUpstash = Boolean(
  process.env.REDIS_REST_URL && process.env.REDIS_REST_TOKEN,
);
const inMemoryLock = new Map<string, { token: string; expiresAt: number }>();

async function acquireLock(
  ttlSeconds: number,
): Promise<{ acquired: boolean; token: string }> {
  const token = randomBytes(16).toString("hex");

  if (hasUpstash) {
    const redis = Redis.fromEnv();
    const result = await redis.set(LOCK_KEY, token, {
      nx: true,
      ex: ttlSeconds,
    });
    return { acquired: result === "OK", token };
  }

  const existing = inMemoryLock.get(LOCK_KEY);
  const now = Date.now();
  if (existing && existing.expiresAt > now) {
    return { acquired: false, token };
  }
  inMemoryLock.set(LOCK_KEY, { token, expiresAt: now + ttlSeconds * 1000 });
  return { acquired: true, token };
}

async function releaseLock(token: string): Promise<void> {
  if (hasUpstash) {
    const redis = Redis.fromEnv();
    const current = await redis.get<string>(LOCK_KEY);
    if (current === token) await redis.del(LOCK_KEY);
    return;
  }

  const existing = inMemoryLock.get(LOCK_KEY);
  if (existing?.token === token) inMemoryLock.delete(LOCK_KEY);
}

function advancePeriod(
  currentEnd: Date,
  interval: string | null,
  intervalCount: number,
): { start: Date; end: Date } {
  const start = new Date(currentEnd);
  const end = new Date(currentEnd);

  const count = intervalCount || 1;
  switch (interval) {
    case "DAY":
      end.setDate(end.getDate() + count);
      break;
    case "WEEK":
      end.setDate(end.getDate() + 7 * count);
      break;
    case "YEAR":
      end.setFullYear(end.getFullYear() + count);
      break;
    case "MONTH":
    default:
      end.setMonth(end.getMonth() + count);
      break;
  }

  return { start, end };
}

async function handleBillingRun() {
  const lock = await acquireLock(60);
  if (!lock.acquired) {
    return NextResponse.json({ status: "locked" }, { status: 202 });
  }

  try {
    const now = new Date();
    const subs = await prisma.subscription.findMany({
      where: { status: "ACTIVE", currentPeriodEnd: { lte: now } },
      include: { items: { include: { price: true } } },
      take: 100,
    });

    let invoicesCreated = 0;

    for (const sub of subs) {
      await prisma.$transaction(async (tx) => {
        let subtotal = 0;
        const lineItems: {
          description: string;
          quantity: number;
          unitAmount: number;
          amount: number;
          currency: string;
          priceId: string;
        }[] = [];

        for (const item of sub.items) {
          const amount = item.price.unitAmount * item.quantity;
          subtotal += amount;
          lineItems.push({
            description: item.price.nickname || `Item ${item.price.id}`,
            quantity: item.quantity,
            unitAmount: item.price.unitAmount,
            amount,
            currency: item.price.currency,
            priceId: item.price.id,
          });
        }

        const currency =
          sub.items[0]?.price.currency ?? "usd";

        const invoice = await tx.invoice.create({
          data: {
            merchantId: sub.merchantId,
            customerId: sub.customerId,
            subscriptionId: sub.id,
            status: "OPEN",
            currency,
            subtotal,
            tax: 0,
            total: subtotal,
            amountPaid: 0,
            amountDue: subtotal,
            periodStart: sub.currentPeriodStart,
            periodEnd: sub.currentPeriodEnd,
            dueDate: new Date(
              now.getTime() + 30 * 24 * 60 * 60 * 1000,
            ),
            items: {
              create: lineItems,
            },
          },
        });

        const firstPrice = sub.items[0]?.price;
        const { start, end } = advancePeriod(
          sub.currentPeriodEnd,
          firstPrice?.billingInterval ?? null,
          firstPrice?.intervalCount ?? 1,
        );

        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            currentPeriodStart: start,
            currentPeriodEnd: end,
          },
        });

        await emitDomainEvent(tx, {
          merchantId: sub.merchantId,
          type: "invoice.created",
          entityType: "invoice",
          entityId: invoice.id,
          payload: {
            invoiceId: invoice.id,
            subscriptionId: sub.id,
            total: subtotal,
            currency,
          },
          actorType: "system",
          actorId: "cron:billing",
        });

        await emitDomainEvent(tx, {
          merchantId: sub.merchantId,
          type: "subscription.period_advanced",
          entityType: "subscription",
          entityId: sub.id,
          payload: {
            subscriptionId: sub.id,
            newPeriodStart: start.toISOString(),
            newPeriodEnd: end.toISOString(),
          },
          actorType: "system",
          actorId: "cron:billing",
        });

        invoicesCreated++;
      });
    }

    return NextResponse.json({
      status: "ok",
      processed: subs.length,
      invoices_created: invoicesCreated,
    });
  } finally {
    await releaseLock(lock.token);
  }
}

export const GET = createHandler({
  auth: "cron",
  handler: async () => handleBillingRun(),
});

export const POST = createHandler({
  auth: "cron",
  handler: async () => handleBillingRun(),
});
