FROM node:16-alpine as build

WORKDIR /app

COPY package.json .
COPY tsconfig.json .
COPY packages/shared ./packages/shared
COPY packages/gql ./packages/gql

RUN npm install

WORKDIR /app/packages/shared
RUN npm run build

WORKDIR /app/packages/gql
RUN npm run build

FROM node:16-alpine

WORKDIR /app

COPY package.json .

COPY --from=build /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist

COPY --from=build /app/packages/gql/package.json /app/packages/gql/package.json
COPY --from=build /app/packages/gql/dist /app/packages/gql/dist

ENV NODE_ENV production
RUN npm install --production

WORKDIR /app/packages/gql

CMD ["npm", "start"]
