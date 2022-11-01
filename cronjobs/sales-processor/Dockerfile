######################################################################
FROM alpine AS utils
######################################################################
# ADD TINI FOR SIGNAL HANDLING, staticly linked
# without tini ctrl-c doesn't work
ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini-static /tini
RUN chmod +x /tini
# Create the user and group files that will be used in the running container to
# run the process as an unprivileged user.
RUN mkdir /user && \
  echo 'nobody:x:65534:65534:nobody:/:' > /user/passwd && \
  echo 'nobody:x:65534:' > /user/group

######################################################################
FROM node:16-alpine as prod-dependencies
######################################################################
WORKDIR /app
ENV NODE_ENV production
COPY packages/gql/package*.json ./packages/gql/
COPY packages/shared/package*.json ./packages/shared/
COPY package*.json ./
RUN apk add --no-cache --virtual .gyp python3 make g++
RUN npm ci

######################################################################
FROM node:16-alpine as dev-dependencies
######################################################################
WORKDIR /app
COPY packages/gql/package*.json ./packages/gql/
COPY packages/shared/package*.json ./packages/shared/
COPY package*.json ./
RUN apk add --no-cache --virtual .gyp python3 make g++
RUN npm ci

######################################################################
FROM node:16-alpine as builder
######################################################################
WORKDIR /app
COPY --from=dev-dependencies /app /app
COPY cronjobs/sales-procesor cronjobs/sales-procesor
COPY packages/cache packages/cache
COPY packages/contract-data packages/contract-data
COPY packages/error-types packages/error-types
COPY packages/nftport-client packages/nftport-client
COPY packages/shared packages/shared
COPY nx.json tsconfig.base.json ./
ENV NODE_ENV production
RUN cd packages/shared && npm run build && cd -
RUN npx nx build ..-cronjobs-sales-procesor

######################################################################
FROM node:16-alpine as final
######################################################################
# Import the user and group files from the first stage.
COPY --from=utils /user/group /user/passwd /etc/
COPY --from=utils /tini /sbin/tini

WORKDIR /app
COPY --from=prod-dependencies /app  .
COPY --from=builder /app/packages/shared /app/packages/shared
COPY --from=builder /app/dist/cronjobs/sales-procesor .

# Perform any further action as an unprivileged user.
USER nobody:nobody

# Set tini as entrypoint
ENTRYPOINT ["tini", "--"]

# Run node app under tini
# CMD ["/nodejs/bin/node", "main.js"]
CMD ["node", "main.js"]