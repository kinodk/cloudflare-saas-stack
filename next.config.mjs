import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

await initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@opennextjs/cloudflare"],
};

export default nextConfig;
