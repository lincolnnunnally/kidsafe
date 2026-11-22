import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The tag page asks the helper's phone for its location. Say so explicitly, so a platform default
  // can never quietly switch geolocation off for it.
  async headers() {
    return [{ source: "/t/:code*", headers: [{ key: "Permissions-Policy", value: "geolocation=(self)" }] }];
  },
  async redirects() {
    return [
      // Kid Safe began inside FurFriend, where its pages lived under /kids. Links sent then keep working.
      { source: "/kids", destination: "/", permanent: true },
      { source: "/kids/:path*", destination: "/:path*", permanent: true },
      { source: "/login", destination: "/family", permanent: false },
      { source: "/signin", destination: "/family", permanent: false },
      { source: "/signup", destination: "/family", permanent: false },
    ];
  },
};

export default nextConfig;
