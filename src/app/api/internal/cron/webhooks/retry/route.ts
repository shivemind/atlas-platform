import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../lib/handler";
import {
  acquireWebhookRetryLock,
  processWebhookRetryQueue,
  releaseWebhookRetryLock,
} from "../../../../../../lib/webhooks";

async function handleRetry() {
  const lock = await acquireWebhookRetryLock(30);
  if (!lock.acquired) {
    return NextResponse.json({ status: "locked" }, { status: 202 });
  }
  try {
    const result = await processWebhookRetryQueue();
    return NextResponse.json({ status: "ok", ...result });
  } finally {
    await releaseWebhookRetryLock(lock);
  }
}

export const GET = createHandler({
  auth: "cron",
  handler: async () => handleRetry(),
});

export const POST = createHandler({
  auth: "cron",
  handler: async () => handleRetry(),
});
