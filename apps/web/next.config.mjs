/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@labelhub/contracts"],
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/agent-api/:path*",
        destination: `${process.env.AGENT_RUNTIME_URL || "http://localhost:8080"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
