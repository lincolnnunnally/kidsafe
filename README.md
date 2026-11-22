# Kid Safe

QR tags for children. If a child gets lost at a theme park, festival or on a field trip, a staff member
scans the tag on the back and calls the family in one tap. The family gets an email the moment it's
scanned. Live at https://kidsafe.unitedundergod.org.

- `src/app`: the site. `/t/CODE` is what a helper sees, `/s/TOKEN` is the "missing child" share page,
  `/family` is the parent's dashboard, `/partners` is for daycares, stores, parks and hotels, `/admin`
  is the partner desk.
- `src/app/api`: scans and alerts, partners, the admin desk, password reset.
- `src/lib`: data access (service role on the server, the parent's own session in the browser), email,
  texts, photos.
- `supabase/migrations`: the `ks_*` tables on the shared LPL Supabase project (already applied).

Environment (Vercel project `kidsafe`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, optional `RESEND_REPLY_TO`, `KIDSAFE_ADMIN_EMAIL`, and the
Twilio variables in `src/lib/sms.ts` once there is a texting number.

```bash
npm install
npm run build
```
