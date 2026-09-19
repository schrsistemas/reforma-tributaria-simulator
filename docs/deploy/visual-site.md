# Visual Site

The visual test surface is intended to run on **Cloudflare Pages**, not GitHub Pages.

Expected public URL after the first successful deployment:

https://reforma-tributaria-simulator.pages.dev/

Deployment is performed by `.github/workflows/cloudflare-pages.yml`.

Required GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The Cloudflare Pages project name is `reforma-tributaria-simulator`.

The site is intentionally static and free-tier-first. Cloudflare Pages is only the presentation/test surface; the Fiscal Domain remains the source of truth for calculations and fiscal knowledge.

Deployment verification is performed from GitHub Actions after each main-branch change.

<!-- Cloudflare deployment verification checkpoint 3 -->