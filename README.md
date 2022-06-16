# NFT.com backend

NFT.com platform's GraphQL server and worker to sync Blockchain data.

[![codecov](https://codecov.io/gh/NFT-com/NFT-backend/branch/main/graph/badge.svg?token=ZD5WGF7BNS)](https://codecov.io/gh/NFT-com/NFT-backend)

## Getting Started

### 1. Requirements

1. Node.js version >=16
2. Docker

### 2. Start Docker and Install Workspaces

1. `docker-compose up -d`
2. `npm install`

The Redis UI is available at `localhost:10015`.

The Postgres instance is available at `localhost:10030`.

## 3. Start GQL Server

1. `cd packages/gql`
2. `cp .env.sample .env`; modify this file if needs be
3. `doppler setup`  Ask the team to be added to the doppler account
4. `npm run dev`

The GraphQL server is available at `localhost:10010`.

#### 3.1. Auth Headers

There are many gql queries/mutations that require client to provide are auth header

1. `network` -> network that user is connected to
2. `chain-id` -> network chain id that user is connected to
3. `authorization` -> signature of the signed message

#### 3.2 How to Generate Signature?

You can use `script/gen-signature.ts` utility to generate signed signature for an address.
This is very useful when testing GQL via playground.

`npm run signature:gen`

The script uses a hardcoded private key. But you can specify your own private key like this

`npm run signature:gen $YOUR_PRIVATE_KEY`

#### 3.3 GQL schema documentation

You can see generated GQL schema documentation at [https://prod-gql-docs.nft.com/documentation/index.html](https://prod-gql-docs.nft.com/documentation/index.html)
since you're logged into GitHub

You can see the automated coverage report at [https://prod-gql-docs.nft.com/coverage/index.html](https://prod-gql-docs.nft.com/coverage/index.html)

