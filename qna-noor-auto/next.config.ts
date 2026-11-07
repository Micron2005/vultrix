import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Identifix CSV imports (C.csv is ~3 MB) exceed the 1 MB default for
  // server-action bodies. 4 MB fits a 2 MiB file plus base64 overhead.
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  async redirects() {
    return [
      { source: "/routines", destination: "/goals/routines", permanent: false },
      {
        source: "/routines/:id",
        destination: "/goals/routines/:id",
        permanent: false,
      },
      { source: "/review", destination: "/reports/review", permanent: false },
    ];
  },
};

export default nextConfig;
