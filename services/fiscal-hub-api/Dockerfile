FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --no-frozen-lockfile --filter @rts/fiscal-hub-api
RUN pnpm --filter @rts/fiscal-hub-api build
ENV NODE_ENV=production
EXPOSE 8080
CMD ["pnpm", "--filter", "@rts/fiscal-hub-api", "start"]
