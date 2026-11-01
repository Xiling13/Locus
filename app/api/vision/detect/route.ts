import { detectWithMuse } from "@/lib/muse/detect";
import type { LedgerObject } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  image?: string;
  base?: LedgerObject[];
};

export async function POST(req: Request) {
  if (!process.env.MODEL_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "MODEL_API_KEY is missing. Copy .env.example to .env.local and set your key." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const image = body.image?.trim();
  if (!image || !image.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "Expected image as a data:image/... URL" },
      { status: 400 },
    );
  }

  try {
    const detections = await detectWithMuse(image, body.base);
    return NextResponse.json({ detections });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vision request failed";
    console.error("[vision/detect]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
