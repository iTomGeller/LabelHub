/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@labelhub/contracts"],
  output: "standalone"
};

export default nextConfig;
