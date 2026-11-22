"use client";

// Browser helpers for the person helping a lost child: a random id this browser keeps, and one location fix.

/** A random id this browser keeps, so a reload or a hop from Wi-Fi to cell counts as the same finder. */
export function browserId(): string | undefined {
  try {
    let id = window.localStorage.getItem("ks-finder");
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem("ks-finder", id);
    }
    return id;
  } catch {
    return undefined;
  }
}

export type Spot = { lat: number; lng: number; accuracy: number };

/** Apps whose built-in browser often can't ask for location (the page works; the prompt doesn't). */
export function inAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|; wv\)|GSA\//i.test(navigator.userAgent);
}

export function isIphone(): boolean {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** One location fix: precise first; if that times out (indoors, weak GPS), a quicker network fix. */
export function locate(): Promise<Spot> {
  const once = (opts: PositionOptions) => new Promise<Spot>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      reject,
      opts,
    );
  });
  return once({ enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }).catch((e: GeolocationPositionError) => {
    if (e && e.code === 1) throw e; // denied: asking again won't help
    return once({ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });
}

