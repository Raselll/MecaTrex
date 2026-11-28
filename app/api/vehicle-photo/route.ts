import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const make = slug(p.get("make") || "");
  const model = slug(p.get("model") || "");
  const year = p.get("year") || "";
  const empty = () => NextResponse.json({ photo: null }, { headers: { "Cache-Control": "no-store" } });
  if (!make || !model || make.length > 50 || model.length > 60 || !/^\d{4}$/.test(year)) return empty();
  const key = year + "-" + make + "-" + model;
  try {
    const dir = join(process.cwd(), "public", "vehicle-catalog");
    const meta = JSON.parse(await readFile(join(dir, key + ".json"), "utf8"));
    if (meta.license !== "CC0" || meta.vehicle !== key) return empty();
    await readFile(join(dir, key + ".webp"));
    return NextResponse.json({ photo: { url: "/vehicle-catalog/" + key + ".webp" } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return empty(); }
}
