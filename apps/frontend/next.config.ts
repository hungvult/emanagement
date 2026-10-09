import type { NextConfig } from "next";

const backendUrl = process.env.INTERNAL_BACKEND_URL || "http://localhost:8080";
const minioUrl = process.env.INTERNAL_MINIO_URL || "http://localhost:9000";
const cvServiceUrl =
  process.env.INTERNAL_CV_SERVICE_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/v1/cv/:path*",
        destination: `${cvServiceUrl}/api/v1/cv/:path*`,
      },
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: "/storage/:path*",
        destination: `${minioUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
