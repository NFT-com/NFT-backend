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



Blockchain sync

- minted profile
- redeemed tokens (letting go of a profile)

Entities

- nft (populated after it is minted)
  - walletId
  - userId
  - nftType
  - contractId
  - metadata
    - tokenId
    - name
    - description
    - imageURL
  - price
  - txHash

- bid
  - walletId
  - userId
  - type (Profile, NFT)
  - stakeWeightedSeconds
  - profileURL
  - price
  - status = [Executed, Submitted]
  - signature
    - v
    - r
    - s
- approval
  - userId
  - walletId
  - amount
  - nonce
  - txHash
  - deadline
  - signature
      - v
      - r
      - s
- edge
  - thisEntity
  - thisEntityId
  - thatEntity
  - thatEntityId
  - edgeType
- waitlist??
- notification
  - userId

User -> Approval -> 


- all bids
- my bids
- bids of a profile

type Bid

- show me my minted profiles (nfts)
- all profiles I am watching
- all people who are watching this


headers
- chainId
- network
- authorization

signUp
  email
  address
  referredBy (userId, email)

frontend login
  sign a generic message "please let me in"
  get signature back
  has an expiry date

type nft {
  wallet
    user -> user in our system
    address
    chainId
  type: [Profile, ERC721, ERC155]
  metadata
    name -> URL
    imageURL -> 
  isOwnedByMe
}
