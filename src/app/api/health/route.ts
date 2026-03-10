import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "@atlas/platform",
    timestamp: new Date().toISOString(),
  });
}
