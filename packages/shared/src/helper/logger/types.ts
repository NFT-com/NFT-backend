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
  Watchlist = 'watchlist',
  MarketAsk = 'marketAsk',
  MarketBid = 'marketBid',
  MarketSwap = 'marketSwap',
  Typesense = 'typesense',
  Bull = 'bull',
  TxActivity = 'txActivity'
}

export enum LogLevel {
  Trace = 'TRACE',
  Debug = 'DEBUG',
  Info = 'INFO',
  Warn = 'WARN',
  Error = 'ERROR',
  Fatal = 'FATAL'
}
