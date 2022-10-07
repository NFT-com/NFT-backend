FROM --platform=linux/arm64 node:16-alpine as deps

WORKDIR /app

COPY package.json ./package.json
COPY .npmrc ./.npmrc
COPY tsconfig.json ./tsconfig.json
COPY packages/sales-processor/package.json ./packages/sales-processor/package.json
COPY packages/sales-processor/tsconfig.json ./sales-processor/tsconfig.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/gql/package.json ./packages/gql/package.json


# add tools for native dependencies (node-gpy)
RUN apk add --no-cache --virtual .gyp python3 make g++ \
    && npm set progress=false \
    && npm install --omit=dev \
    && cp -R node_modules prod_node_modules \
    && npm install \
    && apk del .gyp

COPY packages/sales-processor ./packages/sales-processor
COPY packages/shared ./packages/shared
COPY packages/gql ./packages/gql

FROM deps as build

WORKDIR /app/packages/shared
RUN npm run build

WORKDIR /app/packages/gql
RUN npm install
RUN npm run build

WORKDIR /app/packages/sales-processor
RUN npm run build



FROM --platform=linux/arm64 node:16-alpine as release

WORKDIR /app

COPY --from=deps /app/prod_node_modules ./packages/sales-processor/node_modules
COPY --from=deps /app/prod_node_modules ./node_modules
COPY --from=build /app/packages/gql/node_modules ./packages/gql/node_modules

COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist


COPY --from=build /app/packages/gql/package.json ./packages/gql/package.json
COPY --from=build /app/packages/gql/dist ./packages/gql/dist

COPY --from=build /app/packages/sales-processor/package.json ./packages/sales-processor/package.json
COPY --from=build /app/packages/sales-processor/dist ./packages/sales-processor/dist
COPY --from=build /app/packages/sales-processor/.env ./packages/sales-processor/.env

WORKDIR /app/packages/sales-processor

CMD ["npm", "start"]