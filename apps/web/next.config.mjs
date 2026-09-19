/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: isGitHubPages ? '/reforma-tributaria-simulator' : '',
  assetPrefix: isGitHubPages ? '/reforma-tributaria-simulator/' : '',
};

export default nextConfig;
