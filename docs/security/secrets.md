# Secrets

Cloudflare credentials are never stored in source, README, Wrangler configuration or scenario fixtures.

Local development uses environment variables or an ignored .env file.

CI uses GitHub Actions encrypted repository or environment secrets.

If a token is exposed in chat, logs, commits or screenshots, revoke and rotate it before reuse.
