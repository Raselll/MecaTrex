import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const make = p.get("make")?.trim() || "";
  const model = p.get("model")?.trim() || "";
  const year = p.get("year") || "";
  const color = p.get("color") || "silver";
  const empty = () => NextResponse.json({ photo: null }, { headers: { "Cache-Control": "no-store" } });
  if (!make || !model || make.length > 50 || model.length > 60 || !/^\d{4}$/.test(year)) {
    return NextResponse.json({ photo: null }, { status: 400 });
  }
  // Explicit opt-in: free accounts are for evaluation only, not commercial deployment.
  const key = process.env.CAR_IMAGE_API_KEY;
  if (!key || process.env.CAR_IMAGE_API_ENABLED !== "true") return empty();
  const params = new URLSearchParams({ make, model, year, view: "front-3-4", color: /^[a-fA-F0-9]{6}$/.test(color) ? color : "silver", w: "600", h: "400", trim: "1", padding: "8", background: "white", format: "webp" });
  try {
    const res = await fetch("https://carimage.dev/api/v1/images/car?" + params, {
      headers: { Authorization: "Bearer " + key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) { console.warn("Studio vehicle image unavailable", res.status); return empty(); }
    const data = await res.json();
    const url = new URL(data.data?.url);
    if (url.protocol !== "https:" || url.hostname !== "carimage.dev") return empty();
    return NextResponse.json({ photo: { url: url.href } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return empty(); }
}
