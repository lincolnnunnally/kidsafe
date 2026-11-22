// kidsafe.unitedundergod.org/p/SLUG: a partner's link and display QR (like FurFriend's /p/SLUG).
// Counts the visit, remembers the partner for 30 days, and opens Kid Safe for the parent.

import { approvedKidPartner, kidPartnerCookie, recordKidVisit } from "@/lib/kidpartners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const partner = await approvedKidPartner((await params).slug).catch(() => null);
  if (!partner?.slug) return Response.redirect(new URL("/", request.url), 307);
  await recordKidVisit(partner.id);
  const headers = new Headers({ Location: new URL(`/?from=${partner.slug}`, request.url).toString() });
  headers.append("Set-Cookie", kidPartnerCookie(partner.slug));
  return new Response(null, { status: 307, headers });
}
