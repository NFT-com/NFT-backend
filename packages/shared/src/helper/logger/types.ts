export enum LoggerContext {
  Approval = 'approval',
  Bid = 'bid',
  Cache = 'cache',
  CacheDataLoader = 'dataLoaderCache',
  Curation = 'curation',
  Collection = 'collection',
  General = 'general',
  GraphQL = 'graphql',
  NFT = 'nft',
  Misc = 'misc',
  PageInput = 'pageInput',
  PubSub = 'pubsub',
  Profile = 'profile',
  SendGrid = 'sendgrid',
  User = 'user',
  Wallet = 'wallet',
  MarketAsk = 'marketAsk',
  MarketBid = 'marketBid',
  MarketSwap = 'marketSwap',
}

export enum LogLevel {
  Trace = 'TRACE',
  Debug = 'DEBUG',
  Info = 'INFO',
  Warn = 'WARN',
  Error = 'ERROR',
  Fatal = 'FATAL'
}
