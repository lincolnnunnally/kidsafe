"use client";

// Who's signed in, for the partner pages (they sit outside the community app's AppGate, like tag
// setup does, so a shop owner never lands in community onboarding).

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export function usePartnerSession() {
  const supa = getSupabase();
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; good: boolean } | null>(null);

  useEffect(() => {
    if (!supa) { setReady(true); return; }
    supa.auth.getSession().then(({ data }) => {
      setUid(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    });
    const { data: sub } = supa.auth.onAuthStateChange((_e, session) => {
      setUid(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supa]);

  const flash = useCallback((msg: string, good = false) => {
    setToast({ msg, good });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  /** fetch with the signed-in user's token. */
  const authed = useCallback(async (input: string, init: RequestInit = {}) => {
    const token = (await supa?.auth.getSession())?.data.session?.access_token;
    return fetch(input, { ...init, headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body ? { "Content-Type": "application/json" } : {}) } });
  }, [supa]);

  return { ready, uid, email, toast, flash, authed };
}
