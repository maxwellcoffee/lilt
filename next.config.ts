import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "microphone=(self), camera=(self), accelerometer=(self), gyroscope=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
