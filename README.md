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
