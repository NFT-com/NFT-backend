FROM node:16-alpine as deps

WORKDIR /app

COPY package.json .
COPY .npmrc .
COPY tsconfig.json .
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/gql/package.json ./packages/gql/package.json

RUN npm set progress=false
RUN npm install --production
RUN cp -R node_modules prod_node_modules
RUN npm install

COPY packages/shared ./packages/shared
COPY packages/gql ./packages/gql

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
COPY --from=build /app/packages/gql/.env /app/packages/gql/.env

WORKDIR /app/packages/gql

EXPOSE 8080

CMD ["npm", "start"]
