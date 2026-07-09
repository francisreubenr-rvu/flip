import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: "/flip",
  assetPrefix: "/flip",
  experimental: {
    // The Turbopack persistent FileSystem cache (on by default since Next 16.1)
    // crashes on this machine — the repo lives under a path with spaces and a
    // volume name beginning with a digit ("/Volumes/1TB SSD/…"), which the Rust
    // persistence layer fails to parse ("Loading persistence directory failed:
    // invalid digit found in string"). Disabling it keeps `next dev` stable.
    // Builds are unaffected (build-time FS cache is opt-in and stays off).
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
