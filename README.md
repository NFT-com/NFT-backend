# NFT.com backend

NFT.com platform's GraphQL server and worker to sync Blockchain data.

## Getting Started

### 1. Requirements

1. Node.js version >=16
2. Docker

### 2. Build and Start

1. `npm install`
2. `cp .env.sample .env`; modify this file if needs be
3. `docker-compose up -d`
4. `npm run dev`

The GraphQL server is available at `localhost:10010`.

The Redis UI is available at `localhost:10015`.


### 3. Auth Headers

There are many gql queries/mutations that require client to provide are auth header

1. `network` -> network that user is connected to
2. `chain-id` -> network chain id that user is connected to
3. `authorization` -> signature of the signed message

#### 3.1 How to Generate Signature?

You can use `script/gen-signature.ts` utility to generate signed signature for an address.
This is very useful when testing GQL via playground.

`npm run signature:gen`

The script uses a hardcoded private key. But you can specify your own private key like this

`npm run signature:gen $YOUR_PRIVATE_KEY`
