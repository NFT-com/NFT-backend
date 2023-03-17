FROM node:16-alpine as deps

WORKDIR /app

COPY package*.json ./
COPY .npmrc .
COPY tsconfig.base.json .
COPY packages/shared/package*.json ./packages/shared/
COPY packages/gql/package*.json ./packages/gql/

# add tools for native dependencies (node-gpy)
RUN apk add --no-cache --virtual .gyp python3 make g++ \
    && npm set progress=false \
    && npm ci --omit=dev \
    && cp -R node_modules prod_node_modules \
    && ([ -d "packages/gql/node_modules" ] && cp -R packages/gql/node_modules/. prod_node_modules) || true \
    && ([ -d "packages/shared/node_modules" ] && cp -R packages/shared/node_modules/. prod_node_modules) || true \
    && npm ci \
    && apk del .gyp


COPY packages ./packages/


FROM deps as build

WORKDIR /app/packages/shared
RUN npm run build

WORKDIR /app/packages/gql
RUN npm run build


FROM node:16-alpine as release

WORKDIR /app

COPY --from=deps /app/prod_node_modules ./node_modules

COPY --from=build /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist

COPY --from=build /app/packages/gql/package.json /app/packages/gql/package.json
COPY --from=build /app/packages/gql/dist /app/packages/gql/dist

WORKDIR /app/packages/gql

EXPOSE 8080

CMD ["npm", "start"]

