FROM node:18.16 AS pruner
WORKDIR /app
RUN yarn global add pnpm
COPY . .
RUN pnpm dlx turbo prune --scope=@nftcom/sales-processor --docker


# Add lockfile and package.json's of isolated subworkspace
FROM node:18.16 AS builder
WORKDIR /app
RUN yarn global add pnpm

# First install dependencies (as they change less often)
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --filter=@nftcom/sales-processor...

# Build the project and its dependencies
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json tsconfig.base.json
COPY turbo.json turbo.json

# Uncomment and use build args to enable remote caching
# ARG TURBO_TEAM
# ENV TURBO_TEAM=$TURBO_TEAM

# ARG TURBO_TOKEN
# ENV TURBO_TOKEN=$TURBO_TOKEN

RUN pnpm dlx turbo run build --filter=@nftcom/sales-processor...
RUN cp pnpm-*.yaml dist/ \
  && cd dist  \
  && pnpm install --filter=@nftcom/sales-processor... --prod


FROM node:18.16-bullseye-slim AS runner
ARG CREATED
LABEL org.opencontainers.image.created=$CREATED
ARG COMMIT
LABEL com.nft.sales-processor.commit=$COMMIT
RUN apt-get update && apt-get upgrade -y
WORKDIR /app

# Don't run production as root
USER node
COPY --from=builder /app/dist .

CMD node cronjobs/sales-processor/src/main.js