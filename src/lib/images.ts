// Attributes every photo a family uploaded carries: never leak which page the viewer was on (no
// referrer), and don't fetch photos that are still off-screen.
export const USER_IMG_ATTRS = { loading: "lazy", referrerPolicy: "no-referrer" } as const;
