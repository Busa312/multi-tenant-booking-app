/** @type {import('next').NextConfig} */
const nextConfig = {
  // shared-types/api-client are unbuilt TS workspace packages — Next needs to transpile them itself.
  transpilePackages: ["@booking/api-client", "@booking/shared-types"],
};

export default nextConfig;
