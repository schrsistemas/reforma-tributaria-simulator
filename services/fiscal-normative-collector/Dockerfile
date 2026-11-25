FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --no-frozen-lockfile --filter @rts/fiscal-normative-collector
RUN pnpm --filter @rts/fiscal-normative-collector build
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@rts/fiscal-normative-collector", "check:sources"]
