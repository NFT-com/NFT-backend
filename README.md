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

Workflow

- user bids on a profile
  - approvalSignature
  - nftMintSignature
  - url
  - tokenAmount
  - address
  - chainId
- minting (currently manually triggered)
  - move staked tokens to our contract
  - user has won the bid and self mint
- self minting happens on client side


#### TODO

**1. Blockchain sync**

- minted profile
- redeemed tokens (letting go of a profile)

**2. Impl `EdgeStats` table **

**3. use coreService for mutation of entities **
  - this will make it easier to implement dataloader and caching
  - less code changes
  
**4. validate address checksum **

#### Testing

**1. lodash isEmpty(null || undefined)**
**2. fp functions: do they need to be returning promises?**
