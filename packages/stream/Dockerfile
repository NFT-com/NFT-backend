FROM node:18.16 AS builder
WORKDIR /app
RUN yarn global add pnpm
COPY . .
RUN pnpm dlx turbo prune --scope=@nftcom/stream --docker


# Add lockfile and package.json's of isolated subworkspace
FROM node:18.16 AS installer
WORKDIR /app
RUN yarn global add pnpm

# First install dependencies (as they change less often)
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install

# Build the project and its dependencies
COPY --from=builder /app/out/full/ .
COPY tsconfig.base.json tsconfig.base.json
COPY turbo.json turbo.json

# Uncomment and use build args to enable remote caching
# ARG TURBO_TEAM
# ENV TURBO_TEAM=$TURBO_TEAM

# ARG TURBO_TOKEN
# ENV TURBO_TOKEN=$TURBO_TOKEN

RUN pnpm dlx turbo run build --filter=@nftcom/stream


FROM node:18.16-bullseye-slim AS runner
RUN apt-get update && apt-get upgrade -y
WORKDIR /app

# Don't run production as root
USER node
COPY --from=installer /app .

CMD node packages/stream/dist/main.js