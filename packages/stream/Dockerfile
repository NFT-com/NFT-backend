FROM node:18.16 as deps
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init
WORKDIR /usr/src/app
COPY package*.json /usr/src/app/
COPY packages/stream/package*.json /usr/src/app/packages/stream/
RUN npm pkg delete scripts.prepare \
    && npm set progress=false \
    && npm ci --omit=dev \
    && ([ -d "packages/stream/node_modules" ] && cp -R packages/stream/node_modules/. node_modules) || true


FROM node:18.16 as build
WORKDIR /usr/src/app
COPY . /usr/src/app/
RUN npm pkg delete scripts.prepare && npm set progress=false && npm ci
RUN npx nx build stream


FROM node:18.16-bullseye-slim
RUN apt-get update && apt-get upgrade -y

ENV NODE_PATH=/usr/src/app/node_modules
COPY --from=deps /usr/bin/dumb-init /usr/bin/dumb-init

USER node
WORKDIR /usr/src/app/packages/stream

COPY --chown=node:node --from=deps /usr/src/app/node_modules /usr/src/app/node_modules
COPY --chown=node:node --from=deps /usr/src/app/package.json /usr/src/app/
COPY --chown=node:node --from=build /usr/src/app/tsconfig.base.json /usr/src/app/
COPY --chown=node:node --from=build /usr/src/app/packages/stream/tsconfig*.json /usr/src/app/packages/stream/
COPY --chown=node:node --from=build /usr/src/app/packages/shared/src/db/rds-combined-ca-bundle.cer /usr/src/app/packages/stream/packages/shared/src/db/
COPY --chown=node:node --from=build /usr/src/app/dist/packages/stream /usr/src/app/packages/stream

EXPOSE 8080

CMD ["dumb-init", "node", "-r", "source-map-support/register", "-r", "tsconfig-paths/register", "main.js"]