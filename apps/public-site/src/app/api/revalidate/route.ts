import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { tenantHostTag } from "@/lib/tenant-config";

// Called by apps/api's RevalidationService after a CMS tenant-colors save
// (R50) — shared-secret guarded, mirroring InternalApiKeyGuard's pattern in
// the API but in the opposite direction (API -> public-site).
export async function POST(request: NextRequest) {
  const provided = request.headers.get("x-revalidate-secret");
  const expected = process.env.REVALIDATE_SECRET;

  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ message: "Invalid or missing revalidate secret" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const hosts: unknown = body?.hosts;

  if (!Array.isArray(hosts) || hosts.length === 0 || hosts.some((host) => typeof host !== "string")) {
    return NextResponse.json({ message: "Body must be { hosts: string[] }" }, { status: 400 });
  }

  for (const host of hosts as string[]) {
    revalidateTag(tenantHostTag(host));
  }

  return NextResponse.json({ revalidated: true, hosts });
}
