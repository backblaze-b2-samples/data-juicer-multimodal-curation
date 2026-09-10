import type { NextConfig } from "next";

// Allow `next/image` to optimize remote previews coming from Backblaze B2.
// Presigned download URLs use the bucket-specific S3 hostname pattern:
//   <bucket>.s3.<region>.backblazeb2.com    (path-style and virtual-host)
//   s3.<region>.backblazeb2.com             (path-style)
// One wildcard covers every region + bucket, so this config drops in
// without per-deployment tweaks.
const nextConfig: NextConfig = {
  transpilePackages: ["@data-juicer-multimodal-curation/shared"],
  // The app's own Playwright config and many local setups open the app on the
  // 127.0.0.1 origin. Without this, Next 16's dev cross-origin protection 403s
  // the client bundle from that origin and every control goes dead. Allow both
  // loopback spellings so the app works however it's opened in dev.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.backblazeb2.com",
      },
    ],
  },
};

export default nextConfig;
