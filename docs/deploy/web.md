# Web Deployment

The web application is `apps/web` and is intended for Vercel.

Configure the project against the repository root with Next.js, using:
- Build Command: `pnpm --filter @rts/web build`
- Install Command: `pnpm install --no-frozen-lockfile`
- Environment Variable: `NEXT_PUBLIC_API_URL`

The public URL is only considered final after a successful production deployment and browser verification.

Never expose Cloudflare API credentials in frontend environment variables.
