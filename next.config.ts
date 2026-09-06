import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Thumbnails and models are pre-rendered local files; nothing needs optimising
  // at request time, and this keeps the build free of image-transform work.
  images: { unoptimized: true },
  outputFileTracingIncludes: { "/**": ["./data/models.json"] },
};

export default nextConfig;
