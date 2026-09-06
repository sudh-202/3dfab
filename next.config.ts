import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Thumbnails and models are pre-rendered local files; nothing needs optimising
  // at request time, and this keeps the build free of image-transform work.
  images: { unoptimized: true },
  experimental: {
    // 180+ model pages are prerendered from one shared index. Fanning that out
    // across every core exhausted the memory on a Hobby build container, and
    // each page is cheap, so fewer workers cost almost no wall-clock time.
    cpus: 2,
    staticGenerationMaxConcurrency: 4,
  },
};

export default nextConfig;
