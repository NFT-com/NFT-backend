export type Chain = {
  id: string
  name: string
}

export type EthGetLog = {
  address: string
  topics: string[]
  data: string
  blockNumber: string
  transactionHash: string
  transactionindex: string
  blockHash: string
  logIndex: string
  removed: boolean
}

export type ParsedEthLog = {
  event: string
  signature: string
  address: string
  blockHash: string
  blockNumber: string
  transactionHash: string
  transactionIndex: string
  logIndex: string
  raw: {
    data: string
    topics: string[]
  }
  returnValues: any
}

export type Network = {
  [key: string]: Chain[]
}
