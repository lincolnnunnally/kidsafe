// kidsafe.unitedundergod.org/b/CODE: the QR on a Kid Safe counter display (like FurFriend's /b/CODE).
// Not activated yet: the manager lands on the activation page and becomes a partner on the spot.
// Activated: it counts the visit, remembers the partner for 30 days and opens Kid Safe for the parent.

import { approvedKidPartner, cleanKidBoardCode, kidPartnerCookie, loadKidBoard, recordKidVisit } from "@/lib/kidpartners";
import { rest } from "@/lib/tagserver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = cleanKidBoardCode((await params).code);
  const board = code ? await loadKidBoard(code).catch(() => null) : null;
  if (!board) return Response.redirect(new URL("/", request.url), 307);
  if (!board.partner_id) return Response.redirect(new URL(`/partners/activate?board=${board.code}`, request.url), 307);
  const slug = (await rest<{ slug: string | null }[]>(`ks_partners?select=slug&id=eq.${board.partner_id}`).catch(() => []))[0]?.slug;
  const partner = slug ? await approvedKidPartner(slug).catch(() => null) : null;
  if (!partner?.slug) return Response.redirect(new URL("/", request.url), 307);
  await recordKidVisit(partner.id);
  const headers = new Headers({ Location: new URL(`/?from=${partner.slug}`, request.url).toString() });
  headers.append("Set-Cookie", kidPartnerCookie(partner.slug));
  return new Response(null, { status: 307, headers });
}
