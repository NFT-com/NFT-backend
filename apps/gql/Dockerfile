FROM node:18.16 AS pruner
WORKDIR /app
RUN yarn global add pnpm
COPY . .
RUN pnpm dlx turbo prune --scope=@nftcom/gql --docker


# Add lockfile and package.json's of isolated subworkspace
FROM node:18.16 AS builder
WORKDIR /app
RUN yarn global add pnpm

# First install dependencies (as they change less often)
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --filter=@nftcom/gql...

# Build the project and its dependencies
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json tsconfig.base.json
COPY turbo.json turbo.json

# Uncomment and use build args to enable remote caching
# ARG TURBO_TEAM
# ENV TURBO_TEAM=$TURBO_TEAM

# ARG TURBO_TOKEN
# ENV TURBO_TOKEN=$TURBO_TOKEN

RUN pnpm dlx turbo run build --filter=@nftcom/gql...
RUN cp pnpm-*.yaml dist/ \
    && cd dist  \
    && pnpm install --filter=@nftcom/gql... --prod


FROM node:18.16-bullseye-slim AS runner
ARG BUILD_DATE
LABEL com.nft.gql.build-date=$BUILD_DATE
ARG COMMIT
LABEL com.nft.gql.commit=$COMMIT
RUN apt-get update && apt-get upgrade -y
WORKDIR /app

# Don't run production as root
USER node
COPY --from=builder /app/dist .

CMD node apps/gql/src/index.js