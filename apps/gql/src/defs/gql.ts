export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  Address: any;
  Bytes: any;
  Date: any;
  DateTime: any;
  Uint256: any;
  Upload: any;
};

export enum ActivityExpiration {
  Active = 'Active',
  Both = 'Both',
  Expired = 'Expired'
}

export enum ActivityStatus {
  Cancelled = 'Cancelled',
  Executed = 'Executed',
  Valid = 'Valid'
}

export enum ActivityType {
  Bid = 'Bid',
  Cancel = 'Cancel',
  Listing = 'Listing',
  Purchase = 'Purchase',
  Sale = 'Sale',
  Swap = 'Swap',
  Transfer = 'Transfer'
}

export type AddCommentInput = {
  authorId: Scalars['ID'];
  content: Scalars['String'];
  entityId: Scalars['ID'];
  entityType: SocialEntityType;
};

export type Approval = {
  amount: Scalars['Uint256'];
  createdAt: Scalars['DateTime'];
  currency: Scalars['Address'];
  deadline: Scalars['String'];
  id: Scalars['ID'];
  nonce: Scalars['Int'];
  signature: Signature;
  spender?: Maybe<Scalars['String']>;
  txHash: Scalars['String'];
  wallet?: Maybe<Wallet>;
};

export type ApprovalInput = {
  amount: Scalars['Uint256'];
  currency: Scalars['Address'];
  deadline: Scalars['String'];
  nonce: Scalars['Int'];
  signature: SignatureInput;
  spender: Scalars['String'];
  txHash: Scalars['String'];
  wallet: WalletInput;
};

export type ApprovedAssociationOutput = {
  hidden: Scalars['Boolean'];
  id: Scalars['String'];
  receiver: Scalars['String'];
};

export enum AssetClass {
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
  ETH = 'ETH'
}

export type AssetType = {
  allowAll: Scalars['Boolean'];
  assetClass: AssetClass;
  bytes: Scalars['String'];
  contractAddress: Scalars['Address'];
  tokenId: Scalars['Uint256'];
};

export type AssetTypeInput = {
  allowAll: Scalars['Boolean'];
  assetClass: AssetClass;
  bytes: Scalars['String'];
  contractAddress: Scalars['String'];
  tokenId?: InputMaybe<Scalars['Uint256']>;
};

export type AssociatedAddressesForContractOutput = {
  associatedAddresses?: Maybe<Array<Maybe<Scalars['Address']>>>;
  deployerAddress?: Maybe<Scalars['Address']>;
  deployerIsAssociated?: Maybe<Scalars['Boolean']>;
};

export type Attributes = {
  trait_type: Scalars['String'];
  value: Scalars['String'];
};

export enum AuctionType {
  Decreasing = 'Decreasing',
  English = 'English',
  FixedPrice = 'FixedPrice'
}

export type BaseCoin = {
  address?: Maybe<Scalars['String']>;
  decimals?: Maybe<Scalars['Int']>;
  logoURI?: Maybe<Scalars['String']>;
  symbol?: Maybe<Scalars['String']>;
};

export type Bid = {
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  nftType: NFTType;
  price: Scalars['Uint256'];
  profile?: Maybe<Profile>;
  signature: Signature;
  stakeWeightedSeconds?: Maybe<Scalars['Int']>;
  status: BidStatus;
  updatedAt: Scalars['DateTime'];
  wallet?: Maybe<Wallet>;
};

export type BidInput = {
  nftType: NFTType;
  price: Scalars['Uint256'];
  profileURL?: InputMaybe<Scalars['String']>;
  signature: SignatureInput;
  wallet: WalletInput;
};

export enum BidStatus {
  Executed = 'Executed',
  Submitted = 'Submitted'
}

export type BidsInput = {
  nftType?: InputMaybe<NFTType>;
  pageInput?: InputMaybe<PageInput>;
  profileId?: InputMaybe<Scalars['ID']>;
  wallet?: InputMaybe<WalletInput>;
};

export type BidsOutput = {
  items: Array<Bid>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type BuyNowInput = {
  listingOrderId: Scalars['ID'];
  txHash: Scalars['String'];
};

export type ClearGkIconVisibleOutput = {
  message?: Maybe<Scalars['String']>;
};

export type ClearQueueOutput = {
  message?: Maybe<Scalars['String']>;
};

export type Collection = {
  averagePrice?: Maybe<Scalars['Float']>;
  bannerUrl?: Maybe<Scalars['String']>;
  chainId?: Maybe<Scalars['String']>;
  comments?: Maybe<CommentsOutput>;
  contract?: Maybe<Scalars['Address']>;
  deployer?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  floorPrice?: Maybe<Scalars['Float']>;
  id?: Maybe<Scalars['ID']>;
  isCurated?: Maybe<Scalars['Boolean']>;
  isLikedBy?: Maybe<Scalars['Boolean']>;
  isLikedByUser?: Maybe<Scalars['Boolean']>;
  isOfficial?: Maybe<Scalars['Boolean']>;
  isSpam?: Maybe<Scalars['Boolean']>;
  likeCount?: Maybe<Scalars['Int']>;
  logoUrl?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  slug?: Maybe<Scalars['String']>;
  stats?: Maybe<NFTPortStatistics>;
  totalVolume?: Maybe<Scalars['Float']>;
};


export type CollectionCommentsArgs = {
  pageInput?: InputMaybe<PageInput>;
};


export type CollectionIsLikedByArgs = {
  likedById: Scalars['ID'];
};

export type CollectionInfo = {
  collection?: Maybe<Collection>;
  nftPortResults?: Maybe<NFTPortResults>;
};

export type CollectionInput = {
  chainId?: InputMaybe<Scalars['String']>;
  contract?: InputMaybe<Scalars['Address']>;
  network: Scalars['String'];
  slug?: InputMaybe<Scalars['String']>;
};

export type CollectionLeaderboard = {
  items: Array<Maybe<Collection>>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type CollectionLeaderboardInput = {
  dateRange?: InputMaybe<Scalars['String']>;
  pageInput?: InputMaybe<PageInput>;
};

export type CollectionNFT = {
  actualNumberOfNFTs: Scalars['Int'];
  collectionAddress: Scalars['Address'];
  nfts: Array<NFT>;
};

export type CollectionNFTsInput = {
  chainId?: InputMaybe<Scalars['String']>;
  collectionAddress: Scalars['Address'];
  pageInput?: InputMaybe<PageInput>;
};

export type CollectionTraitsInput = {
  contract: Scalars['Address'];
};

export type CollectionTraitsSummary = {
  stats?: Maybe<TraitsSummaryStats>;
  traits?: Maybe<Array<Maybe<TraitsSummaryData>>>;
};

export type Comment = {
  authorId?: Maybe<Scalars['ID']>;
  content?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['DateTime']>;
  entityId?: Maybe<Scalars['ID']>;
  entityType?: Maybe<SocialEntityType>;
  id?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['DateTime']>;
};

export type CommentsInput = {
  entityId: Scalars['ID'];
  pageInput?: InputMaybe<PageInput>;
};

export type CommentsOutput = {
  items: Array<Maybe<Comment>>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type ContractSalesStatistics = {
  response?: Maybe<Scalars['String']>;
  statistics?: Maybe<NFTPortStatistics>;
};

export type ContractSalesStatisticsInput = {
  contractAddress: Scalars['String'];
};

export type CreateBidInput = {
  auctionType: AuctionType;
  chainId: Scalars['String'];
  end: Scalars['Int'];
  listingId: Scalars['String'];
  makeAsset?: InputMaybe<Array<MarketplaceAssetInput>>;
  makerAddress: Scalars['Address'];
  message?: InputMaybe<Scalars['String']>;
  nonce: Scalars['Int'];
  salt: Scalars['Int'];
  signature: SignatureInput;
  start: Scalars['Int'];
  structHash: Scalars['String'];
  takeAsset?: InputMaybe<Array<MarketplaceAssetInput>>;
  takerAddress: Scalars['Address'];
};

export type CreateCompositeImageInput = {
  profileId: Scalars['ID'];
};

export type CreateCurationInput = {
  items: Array<CurationItemInput>;
};

export type CreateListingInput = {
  auctionType: AuctionType;
  chainId: Scalars['String'];
  end: Scalars['Int'];
  makeAsset?: InputMaybe<Array<MarketplaceAssetInput>>;
  makerAddress: Scalars['Address'];
  message?: InputMaybe<Scalars['String']>;
  nonce: Scalars['Int'];
  salt: Scalars['Int'];
  signature: SignatureInput;
  start: Scalars['Int'];
  structHash: Scalars['String'];
  takeAsset?: InputMaybe<Array<MarketplaceAssetInput>>;
  takerAddress: Scalars['Address'];
};

export type Curation = {
  id: Scalars['ID'];
  items?: Maybe<Array<CurationItem>>;
};

export type CurationInput = {
  curationId: Scalars['ID'];
  pageInput?: InputMaybe<PageInput>;
};

export type CurationItem = {
  id: Scalars['ID'];
  size?: Maybe<NFTSize>;
};

export type CurationItemInput = {
  id: Scalars['ID'];
  size?: InputMaybe<NFTSize>;
};

export type CurationNFT = {
  nft: NFT;
  size?: Maybe<NFTSize>;
};

export type CurationNFTsOutput = {
  items: Array<CurationNFT>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type CurationsInput = {
  pageInput?: InputMaybe<PageInput>;
};

export type CurationsOutput = {
  items: Array<Curation>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type DeleteCommentInput = {
  commentId: Scalars['ID'];
};

export type Event = {
  blockNumber?: Maybe<Scalars['String']>;
  chainId: Scalars['String'];
  contract: Scalars['String'];
  destinationAddress?: Maybe<Scalars['String']>;
  eventName: Scalars['String'];
  hidden?: Maybe<Scalars['Boolean']>;
  hideIgnored?: Maybe<Scalars['Boolean']>;
  id: Scalars['ID'];
  ignore?: Maybe<Scalars['Boolean']>;
  ownerAddress?: Maybe<Scalars['String']>;
  profileUrl?: Maybe<Scalars['String']>;
  txHash: Scalars['String'];
};

export type ExternalListing = {
  baseCoin?: Maybe<BaseCoin>;
  creation?: Maybe<Scalars['DateTime']>;
  exchange?: Maybe<SupportedExternalExchange>;
  expiration?: Maybe<Scalars['DateTime']>;
  highestOffer?: Maybe<Scalars['String']>;
  price?: Maybe<Scalars['String']>;
  url?: Maybe<Scalars['String']>;
};

export type ExternalListingsOutput = {
  listings?: Maybe<Array<Maybe<ExternalListing>>>;
};

export type FileUploadOutput = {
  accessKey: Scalars['String'];
  bucket: Scalars['String'];
  secretKey: Scalars['String'];
  sessionToken: Scalars['String'];
};

export type FillChainIdsInput = {
  chainId?: InputMaybe<Scalars['String']>;
  entity: Scalars['String'];
};

export type FillChainIdsOutput = {
  message?: Maybe<Scalars['String']>;
};

export type FilterListingInput = {
  auctionType?: InputMaybe<AuctionType>;
  chainId?: InputMaybe<Scalars['String']>;
  pageInput: PageInput;
  sortBy?: InputMaybe<ListingSortType>;
};

export type FollowersInput = {
  pageInput?: InputMaybe<PageInput>;
  profileId: Scalars['ID'];
};

export type FollowersOutput = {
  items: Array<Wallet>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type FulfillActivitiesNFTIdOutput = {
  message?: Maybe<Scalars['String']>;
};

export type FullFillEventTokenIdsOutput = {
  message?: Maybe<Scalars['String']>;
};

export type GetGkNFTsOutput = {
  description: Scalars['String'];
  error?: Maybe<Scalars['String']>;
  media?: Maybe<Array<Maybe<NFTMedia>>>;
  metadata?: Maybe<NFTMetadataAlchemy>;
  timeLastUpdated: Scalars['String'];
  title: Scalars['String'];
  tokenUri?: Maybe<TokenUri>;
};

export type GetMarketSwap = {
  items?: Maybe<Array<MarketSwap>>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type GetOrders = {
  items?: Maybe<Array<TxOrder>>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type GetSeaportSignaturesInput = {
  orderHashes: Array<Scalars['String']>;
};

export type GetTxByContract = {
  items?: Maybe<Array<Maybe<NFTPortTxByContractTransactions>>>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type GetTxByNFT = {
  items?: Maybe<Array<Maybe<NFTPortTxByNftTransactions>>>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type GkOutput = {
  metadata: Metadata;
  tokenId: Scalars['String'];
};

export type IgnoredEventsInput = {
  chainId?: InputMaybe<Scalars['String']>;
  profileUrl: Scalars['String'];
  walletAddress: Scalars['Address'];
};

export type InsiderReservedProfilesInput = {
  address: Scalars['Address'];
};

export type LatestProfilesInput = {
  chainId?: InputMaybe<Scalars['String']>;
  pageInput?: InputMaybe<PageInput>;
  sortBy?: InputMaybe<ProfileSortType>;
};

export type LeaderboardInput = {
  chainId?: InputMaybe<Scalars['String']>;
  count?: InputMaybe<Scalars['Int']>;
  pageInput?: InputMaybe<PageInput>;
};

export type LeaderboardOutput = {
  items: Array<LeaderboardProfile>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type LeaderboardProfile = {
  id: Scalars['ID'];
  index?: Maybe<Scalars['Int']>;
  isGKMinted?: Maybe<Scalars['Boolean']>;
  itemsVisible?: Maybe<Scalars['Int']>;
  numberOfCollections?: Maybe<Scalars['Int']>;
  numberOfGenesisKeys?: Maybe<Scalars['Int']>;
  photoURL?: Maybe<Scalars['String']>;
  url: Scalars['String'];
};

export type Like = {
  createdAt?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  likedById?: Maybe<Scalars['String']>;
  likedId?: Maybe<Scalars['String']>;
  likedType?: Maybe<LikeableType>;
  updatedAt?: Maybe<Scalars['DateTime']>;
};

export enum LikeableType {
  Collection = 'Collection',
  NFT = 'NFT',
  Profile = 'Profile'
}

export type ListNFTLooksrareInput = {
  chainId?: InputMaybe<Scalars['String']>;
  looksrareOrder?: InputMaybe<Scalars['String']>;
  memo?: InputMaybe<Scalars['String']>;
  profileUrl?: InputMaybe<Scalars['String']>;
};

export type ListNFTSeaportInput = {
  chainId?: InputMaybe<Scalars['String']>;
  memo?: InputMaybe<Scalars['String']>;
  profileUrl?: InputMaybe<Scalars['String']>;
  seaportParams?: InputMaybe<Scalars['String']>;
  seaportSignature?: InputMaybe<Scalars['String']>;
};

export type ListNFTx2Y2Input = {
  chainId?: InputMaybe<Scalars['String']>;
  contract?: InputMaybe<Scalars['String']>;
  maker?: InputMaybe<Scalars['String']>;
  memo?: InputMaybe<Scalars['String']>;
  profileUrl?: InputMaybe<Scalars['String']>;
  tokenId?: InputMaybe<Scalars['String']>;
  x2y2Order?: InputMaybe<Scalars['String']>;
};

export enum ListingSortType {
  EndingSoon = 'EndingSoon',
  Oldest = 'Oldest',
  RecentlyCreated = 'RecentlyCreated',
  RecentlySold = 'RecentlySold'
}

export type ListingsInput = {
  chainId?: InputMaybe<Scalars['String']>;
  makerAddress?: InputMaybe<Scalars['Address']>;
  pageInput?: InputMaybe<PageInput>;
};

export type LooksrareMerkleProof = {
  position?: Maybe<Scalars['Int']>;
  value?: Maybe<Scalars['String']>;
};

export type LooksrareProtocolData = {
  amount?: Maybe<Scalars['String']>;
  collectionAddress?: Maybe<Scalars['String']>;
  currencyAddress?: Maybe<Scalars['String']>;
  endTime?: Maybe<Scalars['String']>;
  isOrderAsk?: Maybe<Scalars['Boolean']>;
  minPercentageToAsk?: Maybe<Scalars['String']>;
  nonce?: Maybe<Scalars['String']>;
  params?: Maybe<Scalars['String']>;
  price?: Maybe<Scalars['String']>;
  r?: Maybe<Scalars['String']>;
  s?: Maybe<Scalars['String']>;
  signer?: Maybe<Scalars['String']>;
  startTime?: Maybe<Scalars['String']>;
  strategy?: Maybe<Scalars['String']>;
  tokenId?: Maybe<Scalars['String']>;
  v?: Maybe<Scalars['String']>;
};

export type LooksrareV2ProtocolData = {
  additionalParameters?: Maybe<Scalars['String']>;
  amounts?: Maybe<Array<Maybe<Scalars['String']>>>;
  collection?: Maybe<Scalars['String']>;
  collectionType?: Maybe<Scalars['Int']>;
  createdAt?: Maybe<Scalars['String']>;
  currency?: Maybe<Scalars['String']>;
  endTime?: Maybe<Scalars['Int']>;
  globalNonce?: Maybe<Scalars['String']>;
  hash?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  itemIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  merkleProof?: Maybe<Array<Maybe<LooksrareMerkleProof>>>;
  merkleRoot?: Maybe<Scalars['String']>;
  orderNonce?: Maybe<Scalars['String']>;
  price?: Maybe<Scalars['String']>;
  quoteType?: Maybe<Scalars['Int']>;
  signature?: Maybe<Scalars['String']>;
  signer?: Maybe<Scalars['String']>;
  startTime?: Maybe<Scalars['Int']>;
  status?: Maybe<Scalars['String']>;
  strategyId?: Maybe<Scalars['Int']>;
  subsetNonce?: Maybe<Scalars['String']>;
};

export type MarketBidsInput = {
  chainId?: InputMaybe<Scalars['String']>;
  listingOrderId?: InputMaybe<Scalars['String']>;
  makerAddress?: InputMaybe<Scalars['Address']>;
  pageInput?: InputMaybe<PageInput>;
};

export type MarketSwap = {
  blockNumber: Scalars['String'];
  marketAsk?: Maybe<TxListingOrder>;
  marketBid?: Maybe<TxBidOrder>;
  private?: Maybe<Scalars['Boolean']>;
  txHash: Scalars['String'];
};

export type MarketplaceAsset = {
  bytes: Scalars['String'];
  minimumBid: Scalars['Uint256'];
  nftId?: Maybe<Scalars['String']>;
  standard: AssetType;
  value: Scalars['Uint256'];
};

export type MarketplaceAssetInput = {
  bytes: Scalars['String'];
  minimumBid: Scalars['Uint256'];
  standard: AssetTypeInput;
  value: Scalars['Uint256'];
};

export type Metadata = {
  animation_url?: Maybe<Scalars['String']>;
  attributes?: Maybe<Array<Maybe<Attributes>>>;
  description: Scalars['String'];
  image: Scalars['String'];
  name: Scalars['String'];
};

export type MintGkProfileInput = {
  count?: InputMaybe<Scalars['Int']>;
  startIndex?: InputMaybe<Scalars['Int']>;
};

export type Mutation = {
  /** AUTHENTICATED */
  addAddress: Wallet;
  addComment?: Maybe<Comment>;
  addToWatchlist?: Maybe<Scalars['Boolean']>;
  /** AUTHENTICATED */
  approveAmount: Approval;
  bid: Bid;
  /** AUTHENTICATED */
  cancelBid: Scalars['Boolean'];
  /** AUTHENTICATED */
  clearGKIconVisible: ClearGkIconVisibleOutput;
  /** AUTHENTICATED */
  clearQueue: ClearQueueOutput;
  confirmEmail: Scalars['Boolean'];
  /** AUTHENTICATED */
  createCompositeImage: Profile;
  /** AUTHENTICATED - create by curation owner only */
  createCuration: Curation;
  /** AUTHENTICATED */
  createMarketBid: TxBidOrder;
  /** AUTHENTICATED */
  createMarketListing: TxListingOrder;
  deleteComment?: Maybe<Scalars['Boolean']>;
  deleteFromWatchlist?: Maybe<Scalars['Boolean']>;
  fillChainIds: FillChainIdsOutput;
  /** AUTHENTICATED */
  followProfile: Profile;
  /** AUTHENTICATED */
  fulfillActivitiesNFTId: FulfillActivitiesNFTIdOutput;
  /** AUTHENTICATED */
  fullFillEventTokenIds: FullFillEventTokenIdsOutput;
  /** AUTHENTICATED */
  ignoreAssociations: Array<Maybe<Event>>;
  listNFTLooksrare: Scalars['Boolean'];
  listNFTSeaport: Scalars['Boolean'];
  listNFTX2Y2: Scalars['Boolean'];
  mintGKProfile: Scalars['String'];
  /** AUTHENTICATED */
  orderingUpdates: Profile;
  /** AUTHENTICATED */
  profileClaimed: Profile;
  recordView?: Maybe<Scalars['Boolean']>;
  /** AUTHETICATED */
  refreshCollectionRarity: Scalars['String'];
  /** AUTHETICATED */
  refreshMyNFTs: RefreshMyNFTsOutput;
  /** AUTHETICATED */
  refreshNFTOrder: Scalars['String'];
  refreshNft: NFT;
  /** AUTHENTICATED */
  removeCuration: Profile;
  removeDuplicates: RemoveDuplicatesOutput;
  /** AUTHENTICATED */
  resendEmailConfirm: User;
  saveCollectionForContract: SaveCollectionForContractOutput;
  /** AUTHENTICATED */
  saveNFTVisibilityForProfiles: SaveNFTVisibilityForProfilesOutput;
  /** AUTHENTICATED */
  saveScoreForProfiles: SaveScoreForProfilesOutput;
  /** AUTHENTICATED */
  saveUserActionForBuyNFTs: SaveUserActionForBuyNFTsOutput;
  /** AUTHENTICATED */
  sendReferEmail: SendReferEmailOutput;
  /** AUTHETICATED - set by curation + profile owner */
  setCuration: Profile;
  setLike?: Maybe<Like>;
  /** AUTHENTICATED */
  setProfilePreferences: Array<Bid>;
  /** AUTHENTICATED */
  signHash: SignHashOutput;
  /** AUTHENTICATED */
  signHashProfile: SignHashOutput;
  signUp: User;
  /** AUTHENTICATED */
  swapNFT: MarketSwap;
  syncCollectionsWithNFTs: SyncCollectionsWithNFTsOutput;
  /** AUTHENTICATED */
  unfollowProfile: Profile;
  unsetLike?: Maybe<Scalars['Boolean']>;
  updateAssociatedAddresses: UpdateAssociatedAddressesOutput;
  updateAssociatedContract: UpdateAssociatedContractOutput;
  /** AUTHENTICATED */
  updateCache: UpdateCacheOutput;
  updateCollectionImageUrls: UpdateCollectionImageUrlsOutput;
  updateCollectionName: UpdateCollectionNameOutput;
  /** AUTHENTICATED */
  updateCuration: Curation;
  /** AUTHENTICATED */
  updateENSNFTMetadata: UpdateEnsnftMetadataOutput;
  updateEmail: User;
  /** AUTHENTICATED */
  updateHidden: UpdateHiddenOutput;
  /** AUTHENTICATED */
  updateHideIgnored: UpdateHideIgnoredOutput;
  /** AUTHENTICATED */
  updateMe: User;
  /** AUTHENTICATED */
  updateNFTMemo: NFT;
  /** AUTHENTICATED */
  updateNFTProfileId: NFT;
  updateNFTsForProfile: NFTsOutput;
  updateOfficialCollections: UpdateOfficialCollectionsOutput;
  /** AUTHENTICATED */
  updateProfile: Profile;
  /** AUTHENTICATED */
  updateProfileView: Profile;
  /** AUTHENTICATED */
  updateReadByIds: UpdateReadOutput;
  updateSpamStatus: UpdateSpamStatusOutput;
  /** AUTHENTICATED */
  updateStatusByIds: UpdateReadOutput;
  /** AUTHENTICATED */
  updateWalletProfileId: Wallet;
  /** AUTHENTICATED */
  uploadFileSession: FileUploadOutput;
  /** AUTHENTICATED */
  uploadProfileImages: Profile;
};


export type MutationAddAddressArgs = {
  input: WalletInput;
};


export type MutationAddCommentArgs = {
  input: AddCommentInput;
};


export type MutationAddToWatchlistArgs = {
  input: WatchlistInput;
};


export type MutationApproveAmountArgs = {
  input: ApprovalInput;
};


export type MutationBidArgs = {
  input: BidInput;
};


export type MutationCancelBidArgs = {
  id: Scalars['ID'];
};


export type MutationClearQueueArgs = {
  queue: Scalars['String'];
};


export type MutationConfirmEmailArgs = {
  token: Scalars['String'];
};


export type MutationCreateCompositeImageArgs = {
  input?: InputMaybe<CreateCompositeImageInput>;
};


export type MutationCreateCurationArgs = {
  input: CreateCurationInput;
};


export type MutationCreateMarketBidArgs = {
  input: CreateBidInput;
};


export type MutationCreateMarketListingArgs = {
  input: CreateListingInput;
};


export type MutationDeleteCommentArgs = {
  input: DeleteCommentInput;
};


export type MutationDeleteFromWatchlistArgs = {
  input: WatchlistInput;
};


export type MutationFillChainIdsArgs = {
  input: FillChainIdsInput;
};


export type MutationFollowProfileArgs = {
  url?: InputMaybe<Scalars['String']>;
};


export type MutationFulfillActivitiesNFTIdArgs = {
  count: Scalars['Int'];
};


export type MutationFullFillEventTokenIdsArgs = {
  count: Scalars['Int'];
};


export type MutationIgnoreAssociationsArgs = {
  eventIdArray: Array<InputMaybe<Scalars['String']>>;
};


export type MutationListNFTLooksrareArgs = {
  input: ListNFTLooksrareInput;
};


export type MutationListNFTSeaportArgs = {
  input: ListNFTSeaportInput;
};


export type MutationListNFTx2Y2Args = {
  input: ListNFTx2Y2Input;
};


export type MutationMintGkProfileArgs = {
  input?: InputMaybe<MintGkProfileInput>;
};


export type MutationOrderingUpdatesArgs = {
  input: OrderingUpdatesInput;
};


export type MutationProfileClaimedArgs = {
  input: ProfileClaimedInput;
};


export type MutationRecordViewArgs = {
  input: RecordViewInput;
};


export type MutationRefreshCollectionRarityArgs = {
  force?: InputMaybe<Scalars['Boolean']>;
  id: Scalars['ID'];
  ttl?: InputMaybe<Scalars['DateTime']>;
};


export type MutationRefreshNFTOrderArgs = {
  force?: InputMaybe<Scalars['Boolean']>;
  id: Scalars['ID'];
  ttl?: InputMaybe<Scalars['DateTime']>;
};


export type MutationRefreshNFTArgs = {
  chainId?: InputMaybe<Scalars['String']>;
  id: Scalars['ID'];
};


export type MutationRemoveCurationArgs = {
  input: RemoveCurationInput;
};


export type MutationRemoveDuplicatesArgs = {
  contracts: Array<Scalars['Address']>;
};


export type MutationSaveCollectionForContractArgs = {
  contract: Scalars['Address'];
};


export type MutationSaveNFTVisibilityForProfilesArgs = {
  count: Scalars['Int'];
};


export type MutationSaveScoreForProfilesArgs = {
  input: SaveScoreForProfilesInput;
};


export type MutationSaveUserActionForBuyNFTsArgs = {
  profileUrl: Scalars['String'];
};


export type MutationSendReferEmailArgs = {
  input: SendReferEmailInput;
};


export type MutationSetCurationArgs = {
  input: SetCurationInput;
};


export type MutationSetLikeArgs = {
  input: SetLikeInput;
};


export type MutationSetProfilePreferencesArgs = {
  input: ProfilePreferenceInput;
};


export type MutationSignHashArgs = {
  input: SignHashInput;
};


export type MutationSignHashProfileArgs = {
  profileUrl: Scalars['String'];
};


export type MutationSignUpArgs = {
  input: SignUpInput;
};


export type MutationSwapNFTArgs = {
  input: SwapNFTInput;
};


export type MutationSyncCollectionsWithNFTsArgs = {
  count: Scalars['Int'];
};


export type MutationUnfollowProfileArgs = {
  id: Scalars['ID'];
};


export type MutationUnsetLikeArgs = {
  input: UnsetLikeInput;
};


export type MutationUpdateAssociatedAddressesArgs = {
  input?: InputMaybe<UpdateAssociatedAddressesInput>;
};


export type MutationUpdateAssociatedContractArgs = {
  input?: InputMaybe<UpdateAssociatedContractInput>;
};


export type MutationUpdateCacheArgs = {
  input: UpdateCacheInput;
};


export type MutationUpdateCollectionImageUrlsArgs = {
  count: Scalars['Int'];
};


export type MutationUpdateCollectionNameArgs = {
  count: Scalars['Int'];
};


export type MutationUpdateCurationArgs = {
  input: UpdateCurationInput;
};


export type MutationUpdateEnsnftMetadataArgs = {
  count: Scalars['Int'];
};


export type MutationUpdateEmailArgs = {
  input: UpdateEmailInput;
};


export type MutationUpdateHiddenArgs = {
  input: UpdateHiddenInput;
};


export type MutationUpdateHideIgnoredArgs = {
  input: UpdateHideIgnoredInput;
};


export type MutationUpdateMeArgs = {
  input: UpdateUserInput;
};


export type MutationUpdateNFTMemoArgs = {
  memo: Scalars['String'];
  nftId: Scalars['ID'];
};


export type MutationUpdateNFTProfileIdArgs = {
  nftId: Scalars['ID'];
  profileId: Scalars['ID'];
};


export type MutationUpdateNFTsForProfileArgs = {
  input?: InputMaybe<UpdateNFTsForProfileInput>;
};


export type MutationUpdateOfficialCollectionsArgs = {
  list: Scalars['Upload'];
};


export type MutationUpdateProfileArgs = {
  input: UpdateProfileInput;
};


export type MutationUpdateProfileViewArgs = {
  input?: InputMaybe<UpdateProfileViewInput>;
};


export type MutationUpdateReadByIdsArgs = {
  ids: Array<InputMaybe<Scalars['String']>>;
};


export type MutationUpdateSpamStatusArgs = {
  contracts: Array<Scalars['Address']>;
  isSpam: Scalars['Boolean'];
};


export type MutationUpdateStatusByIdsArgs = {
  ids: Array<InputMaybe<Scalars['String']>>;
  status?: InputMaybe<ActivityStatus>;
};


export type MutationUpdateWalletProfileIdArgs = {
  profileId: Scalars['ID'];
};


export type MutationUploadProfileImagesArgs = {
  input?: InputMaybe<UploadProfileImagesInput>;
};

export type NFT = {
  chainId?: Maybe<Scalars['String']>;
  collection?: Maybe<Collection>;
  comments?: Maybe<CommentsOutput>;
  contract?: Maybe<Scalars['Address']>;
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  isGKMinted?: Maybe<Scalars['Boolean']>;
  isHide?: Maybe<Scalars['Boolean']>;
  isLikedBy?: Maybe<Scalars['Boolean']>;
  isLikedByUser?: Maybe<Scalars['Boolean']>;
  isOwnedByMe?: Maybe<Scalars['Boolean']>;
  likeCount?: Maybe<Scalars['Int']>;
  listings?: Maybe<TxActivitiesOutput>;
  memo?: Maybe<Scalars['String']>;
  metadata?: Maybe<NFTMetadata>;
  owner?: Maybe<Scalars['String']>;
  preferredProfile?: Maybe<Profile>;
  previewLink?: Maybe<Scalars['String']>;
  price?: Maybe<Scalars['Uint256']>;
  profileId?: Maybe<Scalars['String']>;
  rarity?: Maybe<Scalars['String']>;
  sortIndex?: Maybe<Scalars['Int']>;
  tokenId: Scalars['Uint256'];
  type: NFTType;
  wallet?: Maybe<Wallet>;
};


export type NFTCommentsArgs = {
  pageInput?: InputMaybe<PageInput>;
};


export type NFTIsLikedByArgs = {
  likedById: Scalars['ID'];
};


export type NFTListingsArgs = {
  listingsExpirationType?: InputMaybe<ActivityExpiration>;
  listingsOwner?: InputMaybe<Scalars['Address']>;
  listingsPageInput?: InputMaybe<PageInput>;
  listingsStatus?: InputMaybe<ActivityStatus>;
  protocol?: InputMaybe<ProtocolType>;
};

export type NFTcomProtocolData = {
  acceptedAt?: Maybe<Scalars['Int']>;
  auctionType?: Maybe<AuctionType>;
  buyNowTaker?: Maybe<Scalars['String']>;
  end?: Maybe<Scalars['Int']>;
  listingId?: Maybe<Scalars['String']>;
  makeAsset?: Maybe<Array<Maybe<MarketplaceAsset>>>;
  rejectedAt?: Maybe<Scalars['Int']>;
  salt?: Maybe<Scalars['Int']>;
  signature?: Maybe<Signature>;
  start?: Maybe<Scalars['Int']>;
  swapTransactionId?: Maybe<Scalars['String']>;
  takeAsset?: Maybe<Array<Maybe<MarketplaceAsset>>>;
};

export type NFTDetail = {
  contract?: Maybe<NFTPortContract>;
  nft?: Maybe<NFTPortNft>;
  owner?: Maybe<Scalars['String']>;
  response?: Maybe<Scalars['String']>;
};

export type NFTDetailInput = {
  contractAddress: Scalars['String'];
  refreshMetadata?: InputMaybe<Scalars['Boolean']>;
  tokenId: Scalars['String'];
};

export type NFTMetadata = {
  description?: Maybe<Scalars['String']>;
  imageURL?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  traits?: Maybe<Array<Maybe<NFTTrait>>>;
};

export type NFTPortContract = {
  metadata?: Maybe<NFTPortContractMetadata>;
  name?: Maybe<Scalars['String']>;
  symbol?: Maybe<Scalars['String']>;
  type?: Maybe<Scalars['String']>;
};

export type NFTPortContractMetadata = {
  banner_url?: Maybe<Scalars['String']>;
  cached_banner_url?: Maybe<Scalars['String']>;
  cached_thumbnail_url?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  thumbnail_url?: Maybe<Scalars['String']>;
};

export type NFTPortNft = {
  animation_url?: Maybe<Scalars['String']>;
  cached_animation_url?: Maybe<Scalars['String']>;
  cached_file_url?: Maybe<Scalars['String']>;
  chain?: Maybe<Scalars['String']>;
  contract_address?: Maybe<Scalars['String']>;
  file_information?: Maybe<NFTPortNftFileInfo>;
  file_url?: Maybe<Scalars['String']>;
  metadata?: Maybe<NFTPortNftMetadata>;
  metadata_url?: Maybe<Scalars['String']>;
  mint_date?: Maybe<Scalars['String']>;
  token_id?: Maybe<Scalars['String']>;
  updated_date?: Maybe<Scalars['String']>;
};

export type NFTPortNftFileInfo = {
  file_size?: Maybe<Scalars['Int']>;
  height?: Maybe<Scalars['Int']>;
  width?: Maybe<Scalars['Int']>;
};

export type NFTPortNftMetadata = {
  animation_url?: Maybe<Scalars['String']>;
  background_color?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  external_url?: Maybe<Scalars['String']>;
  image?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
};

export type NFTPortResults = {
  bannerUrl?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  logoUrl?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  symbol?: Maybe<Scalars['String']>;
};

export type NFTPortStatistics = {
  average_price?: Maybe<Scalars['Float']>;
  floor_price?: Maybe<Scalars['Float']>;
  floor_price_historic_one_day?: Maybe<Scalars['Float']>;
  floor_price_historic_seven_day?: Maybe<Scalars['Float']>;
  floor_price_historic_thirty_day?: Maybe<Scalars['Float']>;
  market_cap?: Maybe<Scalars['Float']>;
  num_owners?: Maybe<Scalars['Int']>;
  one_day_average_price?: Maybe<Scalars['Float']>;
  one_day_change?: Maybe<Scalars['Float']>;
  one_day_sales?: Maybe<Scalars['Int']>;
  one_day_volume?: Maybe<Scalars['Float']>;
  seven_day_average_price?: Maybe<Scalars['Float']>;
  seven_day_change?: Maybe<Scalars['Float']>;
  seven_day_sales?: Maybe<Scalars['Int']>;
  seven_day_volume?: Maybe<Scalars['Float']>;
  thirty_day_average_price?: Maybe<Scalars['Float']>;
  thirty_day_change?: Maybe<Scalars['Float']>;
  thirty_day_sales?: Maybe<Scalars['Int']>;
  thirty_day_volume?: Maybe<Scalars['Float']>;
  total_minted?: Maybe<Scalars['Int']>;
  total_sales?: Maybe<Scalars['Int']>;
  total_supply?: Maybe<Scalars['Int']>;
  total_volume?: Maybe<Scalars['Float']>;
  updated_date?: Maybe<Scalars['String']>;
};

export type NFTPortTxByContractCreators = {
  accountAddress?: Maybe<Scalars['String']>;
  creatorShare?: Maybe<Scalars['String']>;
};

export type NFTPortTxByContractNft = {
  contractAddress?: Maybe<Scalars['String']>;
  contractType?: Maybe<Scalars['String']>;
  creators?: Maybe<Array<Maybe<NFTPortTxByContractCreators>>>;
  metadataUrl?: Maybe<Scalars['String']>;
  royalties?: Maybe<Array<Maybe<NFTPortTxByContractRoyalties>>>;
  signatures?: Maybe<Array<Maybe<Scalars['String']>>>;
  tokenId?: Maybe<Scalars['String']>;
  total?: Maybe<Scalars['Int']>;
};

export type NFTPortTxByContractPriceDetails = {
  assetType?: Maybe<Scalars['String']>;
  contractAddress?: Maybe<Scalars['String']>;
  price?: Maybe<Scalars['String']>;
  priceUSD?: Maybe<Scalars['String']>;
};

export type NFTPortTxByContractRoyalties = {
  accountAddress?: Maybe<Scalars['String']>;
  royaltyShare?: Maybe<Scalars['String']>;
};

export type NFTPortTxByContractTransactions = {
  blockHash?: Maybe<Scalars['String']>;
  blockNumber?: Maybe<Scalars['String']>;
  buyerAddress?: Maybe<Scalars['String']>;
  contractAddress?: Maybe<Scalars['String']>;
  index?: Maybe<Scalars['Int']>;
  marketplace?: Maybe<Scalars['String']>;
  nft?: Maybe<NFTPortTxByContractNft>;
  ownerAddress?: Maybe<Scalars['String']>;
  priceDetails?: Maybe<NFTPortTxByContractPriceDetails>;
  protocolData?: Maybe<TxProtocolData>;
  quantity?: Maybe<Scalars['Int']>;
  sellerAddress?: Maybe<Scalars['String']>;
  tokenId?: Maybe<Scalars['String']>;
  transactionDate?: Maybe<Scalars['DateTime']>;
  transactionHash?: Maybe<Scalars['String']>;
  transferFrom?: Maybe<Scalars['String']>;
  transferTo?: Maybe<Scalars['String']>;
  type?: Maybe<Scalars['String']>;
};

export type NFTPortTxByNftListingDetails = {
  assetType?: Maybe<Scalars['String']>;
  contractAddress?: Maybe<Scalars['String']>;
  price?: Maybe<Scalars['String']>;
  priceUSD?: Maybe<Scalars['String']>;
};

export type NFTPortTxByNftNft = {
  contractAddress?: Maybe<Scalars['String']>;
  contractType?: Maybe<Scalars['String']>;
  tokenId?: Maybe<Scalars['String']>;
};

export type NFTPortTxByNftPriceDetails = {
  assetType?: Maybe<Scalars['String']>;
  contractAddress?: Maybe<Scalars['String']>;
  price?: Maybe<Scalars['String']>;
  priceUSD?: Maybe<Scalars['String']>;
};

export type NFTPortTxByNftTransactions = {
  blockHash?: Maybe<Scalars['String']>;
  blockNumber?: Maybe<Scalars['String']>;
  buyerAddress?: Maybe<Scalars['String']>;
  contractAddress?: Maybe<Scalars['String']>;
  index?: Maybe<Scalars['Int']>;
  listerAddress?: Maybe<Scalars['String']>;
  listingDetails?: Maybe<NFTPortTxByNftListingDetails>;
  marketplace?: Maybe<Scalars['String']>;
  nft?: Maybe<NFTPortTxByNftNft>;
  ownerAddress?: Maybe<Scalars['String']>;
  priceDetails?: Maybe<NFTPortTxByNftPriceDetails>;
  protocolData?: Maybe<TxProtocolData>;
  quantity?: Maybe<Scalars['Int']>;
  sellerAddress?: Maybe<Scalars['String']>;
  tokenId?: Maybe<Scalars['String']>;
  transactionDate?: Maybe<Scalars['DateTime']>;
  transactionHash?: Maybe<Scalars['String']>;
  transferFrom?: Maybe<Scalars['String']>;
  transferTo?: Maybe<Scalars['String']>;
  type?: Maybe<Scalars['String']>;
};

export enum NFTSize {
  Large = 'Large',
  Medium = 'Medium',
  Small = 'Small'
}

export type NFTTrait = {
  rarity?: Maybe<Scalars['String']>;
  type?: Maybe<Scalars['String']>;
  value?: Maybe<Scalars['String']>;
};

export enum NFTType {
  CRYPTO_PUNKS = 'CRYPTO_PUNKS',
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
  GenesisKey = 'GenesisKey',
  GenesisKeyProfile = 'GenesisKeyProfile',
  Profile = 'Profile',
  UNKNOWN = 'UNKNOWN'
}

export type NFTsInput = {
  chainId?: InputMaybe<Scalars['String']>;
  invalidateCache?: InputMaybe<Scalars['Boolean']>;
  ownedByWallet?: InputMaybe<Scalars['Boolean']>;
  pageInput?: InputMaybe<PageInput>;
  profileId?: InputMaybe<Scalars['ID']>;
  query?: InputMaybe<Scalars['String']>;
  types?: InputMaybe<Array<NFTType>>;
};

export type NFTsOutput = {
  items: Array<NFT>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type NFTAttributeRecord = {
  type?: Maybe<Scalars['String']>;
  value?: Maybe<Scalars['String']>;
};

export type NFTListingsInput = {
  chainId?: InputMaybe<Scalars['String']>;
  makerAddress?: InputMaybe<Scalars['Address']>;
  nftContractAddress: Scalars['Address'];
  nftTokenId: Scalars['Uint256'];
};

export type NFTMedia = {
  uri?: Maybe<TokenUri>;
};

export type NFTMetadataAlchemy = {
  attributes?: Maybe<Array<Maybe<NFTAttributeRecord>>>;
  description?: Maybe<Scalars['String']>;
  image?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
};

export type NFTsForCollectionsInput = {
  chainId?: InputMaybe<Scalars['String']>;
  collectionAddresses: Array<Scalars['Address']>;
  count: Scalars['Int'];
};

/**
 * Basic collection type of `isOfficial=true` only collections.
 * (Used for generating sitemaps)
 */
export type OfficialCollection = {
  chainId: Scalars['String'];
  contract: Scalars['Address'];
  id: Scalars['ID'];
  slug?: Maybe<Scalars['String']>;
  updatedAt: Scalars['DateTime'];
};

export type OfficialCollectionNFT = {
  id: Scalars['ID'];
  tokenId: Scalars['Uint256'];
  updatedAt: Scalars['DateTime'];
};

export type OfficialCollectionNFTsInput = {
  chainId?: InputMaybe<Scalars['String']>;
  collectionAddress: Scalars['Address'];
  offsetPageInput?: InputMaybe<OffsetPageInput>;
};

export type OfficialCollectionNFTsOutput = {
  items: Array<OfficialCollectionNFT>;
  pageCount?: Maybe<Scalars['Int']>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type OfficialCollectionsInput = {
  offsetPageInput?: InputMaybe<OffsetPageInput>;
};

export type OfficialCollectionsOutput = {
  items: Array<OfficialCollection>;
  pageCount?: Maybe<Scalars['Int']>;
  totalItems?: Maybe<Scalars['Int']>;
};

/** Offset pagination input */
export type OffsetPageInput = {
  page?: InputMaybe<Scalars['Int']>;
  pageSize?: InputMaybe<Scalars['Int']>;
};

export type OpenseaCollectionV1 = {
  banner_image_url?: Maybe<Scalars['String']>;
  created_date?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  discord_url?: Maybe<Scalars['String']>;
  external_url?: Maybe<Scalars['String']>;
  featured?: Maybe<Scalars['Boolean']>;
  featured_image_url?: Maybe<Scalars['String']>;
  image_url?: Maybe<Scalars['String']>;
  instagram_username?: Maybe<Scalars['String']>;
  large_image_url?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  opensea_buyer_fee_basis_points?: Maybe<Scalars['String']>;
  opensea_seller_fee_basis_points?: Maybe<Scalars['String']>;
  safelist_request_status?: Maybe<Scalars['String']>;
  short_description?: Maybe<Scalars['String']>;
  slug?: Maybe<Scalars['String']>;
  telegram_url?: Maybe<Scalars['String']>;
  twitter_username?: Maybe<Scalars['String']>;
  wiki_url?: Maybe<Scalars['String']>;
};

export type OpenseaContract = {
  address?: Maybe<Scalars['String']>;
  collection?: Maybe<OpenseaCollectionV1>;
  created_date?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  external_link?: Maybe<Scalars['String']>;
  image_url?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  symbol?: Maybe<Scalars['String']>;
  total_supply?: Maybe<Scalars['String']>;
};

export type OpenseaStats = {
  stats?: Maybe<OpenseaStatsV1>;
};

export type OpenseaStatsV1 = {
  average_price?: Maybe<Scalars['String']>;
  count?: Maybe<Scalars['String']>;
  floor_price?: Maybe<Scalars['String']>;
  market_cap?: Maybe<Scalars['String']>;
  num_owners?: Maybe<Scalars['String']>;
  num_reports?: Maybe<Scalars['String']>;
  one_day_average_price?: Maybe<Scalars['String']>;
  one_day_change?: Maybe<Scalars['String']>;
  one_day_sales?: Maybe<Scalars['String']>;
  one_day_volume?: Maybe<Scalars['String']>;
  seven_day_average_price?: Maybe<Scalars['String']>;
  seven_day_change?: Maybe<Scalars['String']>;
  seven_day_sales?: Maybe<Scalars['String']>;
  seven_day_volume?: Maybe<Scalars['String']>;
  thirty_day_average_price?: Maybe<Scalars['String']>;
  thirty_day_change?: Maybe<Scalars['String']>;
  thirty_day_sales?: Maybe<Scalars['String']>;
  thirty_day_volume?: Maybe<Scalars['String']>;
  total_sales?: Maybe<Scalars['String']>;
  total_supply?: Maybe<Scalars['String']>;
  total_volume?: Maybe<Scalars['String']>;
};

export type OrderUpdateInput = {
  newIndex: Scalars['Int'];
  nftId: Scalars['ID'];
};

export type OrderingUpdatesInput = {
  profileId: Scalars['ID'];
  updates: Array<OrderUpdateInput>;
};

export type PageInfo = {
  firstCursor?: Maybe<Scalars['String']>;
  lastCursor?: Maybe<Scalars['String']>;
};

/** Pagination input type */
export type PageInput = {
  afterCursor?: InputMaybe<Scalars['String']>;
  beforeCursor?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};

export type PendingAssociationOutput = {
  id: Scalars['String'];
  owner: Scalars['String'];
  url: Scalars['String'];
};

export type Profile = {
  associatedContract?: Maybe<Scalars['Address']>;
  bannerURL?: Maybe<Scalars['String']>;
  chainId?: Maybe<Scalars['String']>;
  comments?: Maybe<CommentsOutput>;
  createdAt: Scalars['DateTime'];
  deployedContractsVisible?: Maybe<Scalars['Boolean']>;
  description?: Maybe<Scalars['String']>;
  displayType?: Maybe<ProfileDisplayType>;
  expireAt?: Maybe<Scalars['DateTime']>;
  followersCount?: Maybe<Scalars['Int']>;
  gkIconVisible?: Maybe<Scalars['Boolean']>;
  hideCustomization?: Maybe<Scalars['Boolean']>;
  id: Scalars['ID'];
  index?: Maybe<Scalars['Int']>;
  isFollowedByMe?: Maybe<Scalars['Boolean']>;
  isGKMinted?: Maybe<Scalars['Boolean']>;
  isLikedBy?: Maybe<Scalars['Boolean']>;
  isLikedByUser?: Maybe<Scalars['Boolean']>;
  isOwnedByMe?: Maybe<Scalars['Boolean']>;
  layoutType?: Maybe<ProfileLayoutType>;
  likeCount?: Maybe<Scalars['Int']>;
  nftsDescriptionsVisible?: Maybe<Scalars['Boolean']>;
  owner?: Maybe<Wallet>;
  ownerUserId?: Maybe<Scalars['String']>;
  ownerWalletId?: Maybe<Scalars['String']>;
  photoURL?: Maybe<Scalars['String']>;
  profileView?: Maybe<ProfileViewType>;
  status?: Maybe<ProfileStatus>;
  tokenId?: Maybe<Scalars['String']>;
  url: Scalars['String'];
  usersActionsWithPoints?: Maybe<Array<Maybe<UsersActionOutput>>>;
  visibleNFTs?: Maybe<Scalars['Int']>;
  winningBid?: Maybe<Bid>;
};


export type ProfileCommentsArgs = {
  pageInput?: InputMaybe<PageInput>;
};


export type ProfileIsLikedByArgs = {
  likedById: Scalars['ID'];
};

export type ProfileActionOutput = {
  action: ProfileActionType;
  point: Scalars['Int'];
  profileUrl: Scalars['String'];
};

export enum ProfileActionType {
  BuyNFTs = 'BuyNFTs',
  CreateNFTProfile = 'CreateNFTProfile',
  CustomizeProfile = 'CustomizeProfile',
  IssueNFTs = 'IssueNFTs',
  ListNFTs = 'ListNFTs',
  ReferNetwork = 'ReferNetwork'
}

export type ProfileClaimedInput = {
  profileId: Scalars['ID'];
  txHash: Scalars['String'];
  walletId: Scalars['ID'];
};

export enum ProfileDisplayType {
  Collection = 'Collection',
  NFT = 'NFT'
}

export enum ProfileLayoutType {
  Default = 'Default',
  Featured = 'Featured',
  Mosaic = 'Mosaic',
  Spotlight = 'Spotlight'
}

export type ProfilePreferenceInput = {
  urls: Array<Scalars['String']>;
};

export enum ProfileSortType {
  MostVisibleNFTs = 'MostVisibleNFTs',
  RecentMinted = 'RecentMinted',
  RecentUpdated = 'RecentUpdated'
}

export enum ProfileStatus {
  Available = 'Available',
  Owned = 'Owned',
  Pending = 'Pending'
}

export enum ProfileViewType {
  Collection = 'Collection',
  Gallery = 'Gallery'
}

export type ProfileVisibleNFTCount = {
  id: Scalars['String'];
  visibleNFTs: Scalars['Int'];
};

export type ProfilesActionsOutput = {
  action?: Maybe<Array<Maybe<ProfileActionType>>>;
  totalPoints?: Maybe<Scalars['Int']>;
  url?: Maybe<Scalars['String']>;
};

export type ProfilesByDisplayNFTInput = {
  chainId?: InputMaybe<Scalars['String']>;
  collectionAddress?: InputMaybe<Scalars['String']>;
  showOnlyVisibleNFTProfile?: InputMaybe<Scalars['Boolean']>;
  tokenId?: InputMaybe<Scalars['String']>;
};

export type ProfilesByUrlInput = {
  chainId?: InputMaybe<Scalars['String']>;
  url: Scalars['String'];
};

export type ProfilesInput = {
  pageInput?: InputMaybe<PageInput>;
  statuses?: InputMaybe<Array<InputMaybe<ProfileStatus>>>;
};

export type ProfilesOutput = {
  items: Array<Profile>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type ProtocolData = LooksrareProtocolData | LooksrareV2ProtocolData | NFTcomProtocolData | SeaportProtocolData | X2Y2ProtocolData;

export enum ProtocolType {
  LooksRare = 'LooksRare',
  LooksRareV2 = 'LooksRareV2',
  NFTCOM = 'NFTCOM',
  Seaport = 'Seaport',
  X2Y2 = 'X2Y2'
}

export type Query = {
  associatedAddressesForContract: AssociatedAddressesForContractOutput;
  associatedCollectionForProfile: CollectionInfo;
  blockedProfileURI: Scalars['Boolean'];
  collection?: Maybe<CollectionInfo>;
  collectionLeaderboard?: Maybe<CollectionLeaderboard>;
  collectionNFTs: NFTsOutput;
  collectionTraits?: Maybe<CollectionTraitsSummary>;
  collections: Array<Collection>;
  collectionsByDeployer?: Maybe<Array<Maybe<Collection>>>;
  comments?: Maybe<CommentsOutput>;
  curationNFTs: CurationNFTsOutput;
  fetchEthUsd: Scalars['Float'];
  filterListings: GetOrders;
  getActivities: TxActivitiesOutput;
  /** AUTHENTICATED */
  getActivitiesByType?: Maybe<Array<Maybe<TxActivity>>>;
  /** AUTHENTICATED */
  getActivitiesByWalletAddress?: Maybe<Array<Maybe<TxActivity>>>;
  /** AUTHENTICATED */
  getActivitiesByWalletAddressAndType?: Maybe<Array<Maybe<TxActivity>>>;
  /** AUTHENTICATED */
  getApprovedAssociations: Array<Maybe<ApprovedAssociationOutput>>;
  getBids: GetOrders;
  getContractSalesStatistics?: Maybe<ContractSalesStatistics>;
  getListings: GetOrders;
  /** AUTHENTICATED */
  getMyGenesisKeys: Array<Maybe<GkOutput>>;
  /** AUTHENTICATED */
  getMyPendingAssociations: Array<Maybe<PendingAssociationOutput>>;
  getNFTDetails?: Maybe<NFTDetail>;
  /** AUTHENTICATED */
  getProfileActions: Array<Maybe<ProfileActionOutput>>;
  /** AUTHENTICATED */
  getRejectedAssociations: Array<Maybe<RejectedAssociationOutput>>;
  /** AUTHENTICATED */
  getRemovedAssociationsForReceiver: Array<Maybe<RemovedAssociationsForReceiverOutput>>;
  /** AUTHENTICATED */
  getRemovedAssociationsForSender: Array<Maybe<RemovedAssociationsForSenderOutput>>;
  getSales?: Maybe<Array<Maybe<TransactionSales>>>;
  getSeaportSignatures?: Maybe<Array<Maybe<TxOrder>>>;
  /** AUTHENTICATED */
  getSentReferralEmails: Array<Maybe<SentReferralEmailsOutput>>;
  getSwaps: GetMarketSwap;
  getTxByContract?: Maybe<GetTxByContract>;
  getTxByNFT?: Maybe<GetTxByNFT>;
  getUserSwaps: GetMarketSwap;
  gkNFTs: GetGkNFTsOutput;
  ignoredEvents: Array<Event>;
  /** AUTHENTICATED */
  insiderReservedProfiles: Array<Scalars['String']>;
  isAddressWhitelisted: Scalars['Boolean'];
  isProfileCustomized: Scalars['Boolean'];
  latestProfiles: ProfilesOutput;
  leaderboard: LeaderboardOutput;
  /** AUTHENTICATED */
  me: User;
  /** AUTHENTICATED */
  myBids: BidsOutput;
  /** AUTHENTICATED */
  myCurations?: Maybe<CurationsOutput>;
  /** AUTHETICATED */
  myNFTs: NFTsOutput;
  /** AUTHENTICATED */
  myProfiles: ProfilesOutput;
  nft: NFT;
  nftById: NFT;
  nftsForCollections: Array<CollectionNFT>;
  numberOfNFTs?: Maybe<Scalars['Int']>;
  officialCollectionNFTs: OfficialCollectionNFTsOutput;
  officialCollections?: Maybe<OfficialCollectionsOutput>;
  profile: Profile;
  profileFollowers: FollowersOutput;
  profilePassive: Profile;
  profileVisibleNFTCount: Array<ProfileVisibleNFTCount>;
  profiles: Array<Profile>;
  profilesByDisplayNft: ProfilesOutput;
  /** AUTHENTICATED */
  profilesFollowedByMe: ProfilesOutput;
  profilesMintedByGK: Array<Profile>;
  /** AUTHENTICATED */
  searchNFTsForProfile: NFTsOutput;
  searchVisibleNFTsForProfile: NFTsOutput;
  topBids: BidsOutput;
  validateProfileGKOwners: Array<ValidateProfileGkOwners>;
  watchlist: Watchlist;
};


export type QueryAssociatedAddressesForContractArgs = {
  contract: Scalars['Address'];
};


export type QueryAssociatedCollectionForProfileArgs = {
  chainId?: InputMaybe<Scalars['String']>;
  url: Scalars['String'];
};


export type QueryBlockedProfileUriArgs = {
  blockReserved: Scalars['Boolean'];
  url: Scalars['String'];
};


export type QueryCollectionArgs = {
  input: CollectionInput;
};


export type QueryCollectionLeaderboardArgs = {
  input?: InputMaybe<CollectionLeaderboardInput>;
};


export type QueryCollectionNFTsArgs = {
  input: CollectionNFTsInput;
};


export type QueryCollectionTraitsArgs = {
  input: CollectionTraitsInput;
};


export type QueryCollectionsArgs = {
  input: Array<CollectionInput>;
};


export type QueryCollectionsByDeployerArgs = {
  deployer: Scalars['String'];
};


export type QueryCommentsArgs = {
  input: CommentsInput;
};


export type QueryCurationNFTsArgs = {
  input: CurationInput;
};


export type QueryFilterListingsArgs = {
  input: FilterListingInput;
};


export type QueryGetActivitiesArgs = {
  input?: InputMaybe<TxActivitiesInput>;
};


export type QueryGetActivitiesByTypeArgs = {
  activityType?: InputMaybe<Scalars['String']>;
  chainId?: InputMaybe<Scalars['String']>;
};


export type QueryGetActivitiesByWalletAddressArgs = {
  chainId?: InputMaybe<Scalars['String']>;
  walletAddress?: InputMaybe<Scalars['String']>;
};


export type QueryGetActivitiesByWalletAddressAndTypeArgs = {
  input?: InputMaybe<TxWalletAddressAndTypeInput>;
};


export type QueryGetApprovedAssociationsArgs = {
  profileUrl: Scalars['String'];
};


export type QueryGetBidsArgs = {
  input: MarketBidsInput;
};


export type QueryGetContractSalesStatisticsArgs = {
  input?: InputMaybe<ContractSalesStatisticsInput>;
};


export type QueryGetListingsArgs = {
  input: ListingsInput;
};


export type QueryGetNFTDetailsArgs = {
  input?: InputMaybe<NFTDetailInput>;
};


export type QueryGetRejectedAssociationsArgs = {
  profileUrl: Scalars['String'];
};


export type QueryGetRemovedAssociationsForSenderArgs = {
  profileUrl: Scalars['String'];
};


export type QueryGetSalesArgs = {
  input?: InputMaybe<TransactionSalesInput>;
};


export type QueryGetSeaportSignaturesArgs = {
  input?: InputMaybe<GetSeaportSignaturesInput>;
};


export type QueryGetSentReferralEmailsArgs = {
  profileUrl: Scalars['String'];
};


export type QueryGetSwapsArgs = {
  input: SwapsInput;
};


export type QueryGetTxByContractArgs = {
  input?: InputMaybe<TransactionsByContractInput>;
};


export type QueryGetTxByNFTArgs = {
  input?: InputMaybe<TransactionsByNFTInput>;
};


export type QueryGetUserSwapsArgs = {
  input: UserSwapsInput;
};


export type QueryGkNFTsArgs = {
  chainId?: InputMaybe<Scalars['String']>;
  tokenId: Scalars['String'];
};


export type QueryIgnoredEventsArgs = {
  input: IgnoredEventsInput;
};


export type QueryInsiderReservedProfilesArgs = {
  input: InsiderReservedProfilesInput;
};


export type QueryIsAddressWhitelistedArgs = {
  input?: InputMaybe<WhitelistCheckInput>;
};


export type QueryIsProfileCustomizedArgs = {
  chainId?: InputMaybe<Scalars['String']>;
  url: Scalars['String'];
};


export type QueryLatestProfilesArgs = {
  input?: InputMaybe<LatestProfilesInput>;
};


export type QueryLeaderboardArgs = {
  input?: InputMaybe<LeaderboardInput>;
};


export type QueryMyBidsArgs = {
  input?: InputMaybe<BidsInput>;
};


export type QueryMyCurationsArgs = {
  input: CurationsInput;
};


export type QueryMyNFTsArgs = {
  input?: InputMaybe<NFTsInput>;
};


export type QueryMyProfilesArgs = {
  input?: InputMaybe<ProfilesInput>;
};


export type QueryNFTArgs = {
  chainId?: InputMaybe<Scalars['String']>;
  contract: Scalars['Address'];
  id: Scalars['String'];
};


export type QueryNFTByIdArgs = {
  id: Scalars['ID'];
};


export type QueryNFTsForCollectionsArgs = {
  input: NFTsForCollectionsInput;
};


export type QueryNumberOfNFTsArgs = {
  chainId?: InputMaybe<Scalars['String']>;
  contract: Scalars['Address'];
};


export type QueryOfficialCollectionNFTsArgs = {
  input: OfficialCollectionNFTsInput;
};


export type QueryOfficialCollectionsArgs = {
  input: OfficialCollectionsInput;
};


export type QueryProfileArgs = {
  chainId?: InputMaybe<Scalars['String']>;
  url: Scalars['String'];
};


export type QueryProfileFollowersArgs = {
  input: FollowersInput;
};


export type QueryProfilePassiveArgs = {
  chainId?: InputMaybe<Scalars['String']>;
  url: Scalars['String'];
};


export type QueryProfileVisibleNFTCountArgs = {
  chainId?: InputMaybe<Scalars['String']>;
  profileIds: Array<Scalars['String']>;
};


export type QueryProfilesArgs = {
  input: Array<ProfilesByUrlInput>;
};


export type QueryProfilesByDisplayNFTArgs = {
  input: ProfilesByDisplayNFTInput;
};


export type QueryProfilesFollowedByMeArgs = {
  input?: InputMaybe<ProfilesInput>;
};


export type QueryProfilesMintedByGkArgs = {
  chainId?: InputMaybe<Scalars['String']>;
  tokenId: Scalars['String'];
};


export type QuerySearchNFTsForProfileArgs = {
  input: SearchNFTsForProfileInput;
};


export type QuerySearchVisibleNFTsForProfileArgs = {
  input: SearchVisibleNFTsForProfileInput;
};


export type QueryTopBidsArgs = {
  input?: InputMaybe<TopBidsInput>;
};


export type QueryValidateProfileGkOwnersArgs = {
  chainId?: InputMaybe<Scalars['String']>;
  profileIds: Array<Scalars['String']>;
};


export type QueryWatchlistArgs = {
  userId: Scalars['ID'];
};

export type RecordViewInput = {
  viewedId: Scalars['ID'];
  viewedType: ViewableType;
  viewerId: Scalars['ID'];
  viewerType: ViewerType;
};

export type RefreshMyNFTsOutput = {
  message?: Maybe<Scalars['String']>;
  status: Scalars['Boolean'];
};

export type RejectedAssociationOutput = {
  hidden: Scalars['Boolean'];
  id: Scalars['String'];
  receiver: Scalars['String'];
};

export type RemoveCurationInput = {
  profileId: Scalars['ID'];
};

export type RemoveDuplicatesOutput = {
  message?: Maybe<Scalars['String']>;
};

export type RemovedAssociationsForReceiverOutput = {
  hidden: Scalars['Boolean'];
  id: Scalars['String'];
  owner: Scalars['String'];
  url: Scalars['String'];
};

export type RemovedAssociationsForSenderOutput = {
  hidden: Scalars['Boolean'];
  id: Scalars['String'];
  receiver: Scalars['String'];
};

export type SaveNFTVisibilityForProfilesOutput = {
  message?: Maybe<Scalars['String']>;
};

export type SaveScoreForProfilesInput = {
  count?: InputMaybe<Scalars['Int']>;
  nullOnly?: InputMaybe<Scalars['Boolean']>;
};

export type SaveScoreForProfilesOutput = {
  message?: Maybe<Scalars['String']>;
};

export type SaveUserActionForBuyNFTsOutput = {
  message?: Maybe<Scalars['String']>;
};

export type SeaportConsideration = {
  endAmount?: Maybe<Scalars['String']>;
  identifierOrCriteria?: Maybe<Scalars['String']>;
  itemType?: Maybe<Scalars['Int']>;
  recipient?: Maybe<Scalars['String']>;
  startAmount?: Maybe<Scalars['String']>;
  token?: Maybe<Scalars['String']>;
};

export type SeaportOffer = {
  endAmount?: Maybe<Scalars['String']>;
  identifierOrCriteria?: Maybe<Scalars['String']>;
  itemType?: Maybe<Scalars['Int']>;
  startAmount?: Maybe<Scalars['String']>;
  token?: Maybe<Scalars['String']>;
};

export type SeaportProtocolData = {
  parameters?: Maybe<SeaportProtocolDataParams>;
  signature?: Maybe<Scalars['String']>;
};

export type SeaportProtocolDataParams = {
  conduitKey?: Maybe<Scalars['String']>;
  consideration?: Maybe<Array<Maybe<SeaportConsideration>>>;
  counter?: Maybe<Scalars['String']>;
  endTime?: Maybe<Scalars['String']>;
  offer?: Maybe<Array<Maybe<SeaportOffer>>>;
  offerer?: Maybe<Scalars['String']>;
  orderType?: Maybe<Scalars['Int']>;
  salt?: Maybe<Scalars['String']>;
  startTime?: Maybe<Scalars['String']>;
  totalOriginalConsiderationItems?: Maybe<Scalars['Int']>;
  zone?: Maybe<Scalars['String']>;
  zoneHash?: Maybe<Scalars['String']>;
};

export type SearchNFTsForProfileInput = {
  chainId?: InputMaybe<Scalars['String']>;
  pageInput?: InputMaybe<PageInput>;
  query: Scalars['String'];
  url: Scalars['String'];
};

export type SearchVisibleNFTsForProfileInput = {
  chainId?: InputMaybe<Scalars['String']>;
  pageInput?: InputMaybe<PageInput>;
  query: Scalars['String'];
  url: Scalars['String'];
};

export type SendReferEmailInput = {
  emails: Array<Scalars['String']>;
  profileUrl: Scalars['String'];
};

export type SendReferEmailOutput = {
  confirmedEmails: Array<Maybe<Scalars['String']>>;
  message?: Maybe<Scalars['String']>;
  sentEmails: Array<Maybe<Scalars['String']>>;
  unconfirmedEmails: Array<Maybe<Scalars['String']>>;
};

export type SentReferralEmailsOutput = {
  accepted: Scalars['Boolean'];
  email: Scalars['String'];
  timestamp: Scalars['DateTime'];
};

export type SetCurationInput = {
  curationId: Scalars['ID'];
  profileId: Scalars['ID'];
};

export type SetLikeInput = {
  likedById: Scalars['String'];
  likedId: Scalars['String'];
  likedType: LikeableType;
};

export type SignHashInput = {
  timestamp: Scalars['String'];
};

export type SignHashOutput = {
  hash: Scalars['String'];
  signature: Scalars['String'];
};

export type SignUpInput = {
  avatarURL?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['String']>;
  referralId?: InputMaybe<Scalars['String']>;
  referredBy?: InputMaybe<Scalars['String']>;
  referredUrl?: InputMaybe<Scalars['String']>;
  username?: InputMaybe<Scalars['String']>;
  wallet: WalletInput;
};

export type Signature = {
  r: Scalars['Bytes'];
  s: Scalars['Bytes'];
  v: Scalars['Int'];
};

export type SignatureInput = {
  r: Scalars['Bytes'];
  s: Scalars['Bytes'];
  v: Scalars['Int'];
};

export enum SocialEntityType {
  Collection = 'Collection',
  NFT = 'NFT',
  Profile = 'Profile'
}

export enum SupportedExternalExchange {
  Looksrare = 'looksrare',
  Opensea = 'opensea',
  Rarible = 'rarible',
  X2y2 = 'x2y2'
}

export type SwapNFTInput = {
  marketAskId: Scalars['ID'];
  marketBidId: Scalars['ID'];
  txHash: Scalars['String'];
};

export type SwapsInput = {
  marketAskIds?: InputMaybe<Array<InputMaybe<Scalars['ID']>>>;
  marketBidIds?: InputMaybe<Array<InputMaybe<Scalars['ID']>>>;
  pageInput?: InputMaybe<PageInput>;
};

export type SyncCollectionsWithNFTsOutput = {
  message?: Maybe<Scalars['String']>;
};

export type TokenUri = {
  gateway: Scalars['String'];
  raw: Scalars['String'];
};

export type TopBidsInput = {
  pageInput?: InputMaybe<PageInput>;
  profileId?: InputMaybe<Scalars['ID']>;
  status?: InputMaybe<BidStatus>;
};

export type TraitCounts = {
  count?: Maybe<Scalars['Int']>;
  value?: Maybe<Scalars['String']>;
};

export type TraitsSummaryData = {
  counts?: Maybe<Array<Maybe<TraitCounts>>>;
  type?: Maybe<Scalars['String']>;
};

export type TraitsSummaryStats = {
  totalCount?: Maybe<Scalars['Int']>;
};

export type TransactionSales = {
  contractAddress?: Maybe<Scalars['String']>;
  date?: Maybe<Scalars['DateTime']>;
  price?: Maybe<Scalars['Float']>;
  priceUSD?: Maybe<Scalars['Float']>;
  symbol?: Maybe<Scalars['String']>;
  tokenId?: Maybe<Scalars['String']>;
  transaction?: Maybe<TransactionSalesTx>;
};

export type TransactionSalesInput = {
  contractAddress: Scalars['Address'];
  dateRange?: InputMaybe<Scalars['String']>;
  tokenId?: InputMaybe<Scalars['String']>;
};

export type TransactionSalesTx = {
  block_hash?: Maybe<Scalars['String']>;
  block_number?: Maybe<Scalars['Int']>;
  buyer_address?: Maybe<Scalars['String']>;
  lister_address?: Maybe<Scalars['String']>;
  marketplace?: Maybe<Scalars['String']>;
  nft?: Maybe<NFTPortTxByNftNft>;
  price_details?: Maybe<NFTPortTxByContractPriceDetails>;
  quantity?: Maybe<Scalars['Int']>;
  seller_address?: Maybe<Scalars['String']>;
  transaction_date?: Maybe<Scalars['String']>;
  transaction_hash?: Maybe<Scalars['String']>;
  type?: Maybe<Scalars['String']>;
};

export type TransactionsByContractInput = {
  chain?: InputMaybe<Scalars['String']>;
  contractAddress: Scalars['String'];
  pageInput: PageInput;
  type?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
};

export type TransactionsByNFTInput = {
  chain?: InputMaybe<Scalars['String']>;
  contractAddress: Scalars['String'];
  pageInput: PageInput;
  tokenId: Scalars['String'];
  type?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
};

export type TxActivitiesInput = {
  activityType?: InputMaybe<ActivityType>;
  chainId?: InputMaybe<Scalars['String']>;
  contract?: InputMaybe<Scalars['String']>;
  expirationType?: InputMaybe<ActivityExpiration>;
  pageInput: PageInput;
  read?: InputMaybe<Scalars['Boolean']>;
  skipRelations?: InputMaybe<Scalars['Boolean']>;
  status?: InputMaybe<ActivityStatus>;
  tokenId?: InputMaybe<Scalars['String']>;
  walletAddress?: InputMaybe<Scalars['String']>;
};

export type TxActivitiesOutput = {
  items?: Maybe<Array<Maybe<TxActivity>>>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type TxActivity = {
  activityType: ActivityType;
  activityTypeId: Scalars['String'];
  cancel?: Maybe<TxCancel>;
  chainId?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  index?: Maybe<Scalars['Int']>;
  nftContract: Scalars['String'];
  nftId: Array<Maybe<Scalars['String']>>;
  order?: Maybe<TxOrder>;
  read: Scalars['Boolean'];
  status: ActivityStatus;
  timestamp: Scalars['DateTime'];
  transaction?: Maybe<TxTransaction>;
  walletAddress: Scalars['String'];
};

export type TxBidOrder = {
  auctionType: AuctionType;
  chainId: Scalars['String'];
  end: Scalars['DateTime'];
  id: Scalars['ID'];
  makerAddress: Scalars['Address'];
  memo?: Maybe<Scalars['String']>;
  nonce: Scalars['Int'];
  orderHash: Scalars['String'];
  salt: Scalars['Int'];
  signature: Signature;
  start: Scalars['DateTime'];
  takerAddress: Scalars['Address'];
};

export type TxCancel = {
  blockNumber: Scalars['String'];
  exchange: Scalars['String'];
  foreignKeyId: Scalars['String'];
  foreignType: Scalars['String'];
  id: Scalars['ID'];
  transactionHash: Scalars['String'];
};

export type TxConsideration = {
  chainId?: Maybe<Scalars['String']>;
  endAmount?: Maybe<Scalars['String']>;
  recipient?: Maybe<Scalars['String']>;
  startAmount: Scalars['String'];
  token: Scalars['String'];
};

export type TxListingOrder = {
  auctionType: AuctionType;
  chainId: Scalars['String'];
  end: Scalars['DateTime'];
  id: Scalars['ID'];
  makerAddress: Scalars['Address'];
  memo?: Maybe<Scalars['String']>;
  nonce: Scalars['Int'];
  orderHash: Scalars['String'];
  salt: Scalars['Int'];
  signature: Signature;
  start: Scalars['DateTime'];
};

export type TxLooksrareProtocolData = {
  amount?: Maybe<Scalars['String']>;
  collectionAddress?: Maybe<Scalars['String']>;
  currencyAddress?: Maybe<Scalars['String']>;
  endTime?: Maybe<Scalars['String']>;
  isOrderAsk?: Maybe<Scalars['Boolean']>;
  minPercentageToAsk?: Maybe<Scalars['String']>;
  nonce?: Maybe<Scalars['String']>;
  params?: Maybe<Scalars['String']>;
  price?: Maybe<Scalars['String']>;
  r?: Maybe<Scalars['String']>;
  s?: Maybe<Scalars['String']>;
  signer?: Maybe<Scalars['String']>;
  startTime?: Maybe<Scalars['String']>;
  strategy?: Maybe<Scalars['String']>;
  tokenId?: Maybe<Scalars['String']>;
  v?: Maybe<Scalars['String']>;
};

export type TxLooksrareV2ProtocolData = {
  additionalParameters?: Maybe<Scalars['String']>;
  amounts?: Maybe<Array<Maybe<Scalars['String']>>>;
  collection?: Maybe<Scalars['String']>;
  collectionType?: Maybe<Scalars['Int']>;
  createdAt?: Maybe<Scalars['String']>;
  currency?: Maybe<Scalars['String']>;
  endTime?: Maybe<Scalars['Int']>;
  globalNonce?: Maybe<Scalars['String']>;
  hash?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  itemIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  merkleProof?: Maybe<Array<Maybe<LooksrareMerkleProof>>>;
  merkleRoot?: Maybe<Scalars['String']>;
  orderNonce?: Maybe<Scalars['String']>;
  price?: Maybe<Scalars['String']>;
  quoteType?: Maybe<Scalars['Int']>;
  signature?: Maybe<Scalars['String']>;
  signer?: Maybe<Scalars['String']>;
  startTime?: Maybe<Scalars['Int']>;
  status?: Maybe<Scalars['String']>;
  strategyId?: Maybe<Scalars['Int']>;
  subsetNonce?: Maybe<Scalars['String']>;
};

export type TxNFTcomProtocolData = {
  acceptedAt?: Maybe<Scalars['Int']>;
  auctionType?: Maybe<AuctionType>;
  bidOrderId?: Maybe<Scalars['String']>;
  buyNowTaker?: Maybe<Scalars['String']>;
  end?: Maybe<Scalars['Int']>;
  listingId?: Maybe<Scalars['String']>;
  listingOrderId?: Maybe<Scalars['String']>;
  makeAsset?: Maybe<Array<Maybe<MarketplaceAsset>>>;
  private?: Maybe<Scalars['Boolean']>;
  rejectedAt?: Maybe<Scalars['Int']>;
  salt?: Maybe<Scalars['Int']>;
  signature?: Maybe<Signature>;
  start?: Maybe<Scalars['Int']>;
  swapTransactionId?: Maybe<Scalars['String']>;
  takeAsset?: Maybe<Array<Maybe<MarketplaceAsset>>>;
};

export type TxOffer = {
  chainId?: Maybe<Scalars['String']>;
  endAmount?: Maybe<Scalars['String']>;
  startAmount: Scalars['String'];
  token: Scalars['String'];
};

export type TxOrder = {
  chainId?: Maybe<Scalars['String']>;
  exchange: Scalars['String'];
  id: Scalars['ID'];
  makerAddress: Scalars['String'];
  memo?: Maybe<Scalars['String']>;
  nonce?: Maybe<Scalars['Int']>;
  orderHash: Scalars['String'];
  orderType: Scalars['String'];
  osNonce?: Maybe<Scalars['String']>;
  protocol: Scalars['String'];
  protocolData?: Maybe<ProtocolData>;
  takerAddress?: Maybe<Scalars['String']>;
};

export type TxProtocolData = TxLooksrareProtocolData | TxLooksrareV2ProtocolData | TxNFTcomProtocolData | TxSeaportProtocolData | TxX2Y2ProtocolData;

export type TxSeaportProtocolData = {
  consideration?: Maybe<Array<Maybe<SeaportConsideration>>>;
  offer?: Maybe<Array<Maybe<SeaportOffer>>>;
};

export type TxTransaction = {
  blockNumber: Scalars['String'];
  chainId?: Maybe<Scalars['String']>;
  exchange: Scalars['String'];
  id: Scalars['ID'];
  maker: Scalars['String'];
  nftContractAddress: Scalars['String'];
  nftContractTokenId: Scalars['String'];
  protocol: Scalars['String'];
  protocolData?: Maybe<TxProtocolData>;
  taker: Scalars['String'];
  transactionHash: Scalars['String'];
};

export type TxWalletAddressAndTypeInput = {
  activityType: Scalars['String'];
  chainId?: InputMaybe<Scalars['String']>;
  pageInput?: InputMaybe<PageInput>;
  walletAddress: Scalars['String'];
};

export type TxX2Y2Fee = {
  percentage?: Maybe<Scalars['String']>;
  to?: Maybe<Scalars['String']>;
};

export type TxX2Y2OrderItem = {
  data?: Maybe<Scalars['String']>;
  price?: Maybe<Array<Maybe<Scalars['String']>>>;
};

export type TxX2Y2ProtocolData = {
  amount?: Maybe<Scalars['String']>;
  currency?: Maybe<Scalars['String']>;
  data?: Maybe<Scalars['String']>;
  deadline?: Maybe<Scalars['String']>;
  delegateType?: Maybe<Scalars['String']>;
  intent?: Maybe<Scalars['String']>;
  orderSalt?: Maybe<Scalars['String']>;
  settleSalt?: Maybe<Scalars['String']>;
};

export type TxX2Y2SettleDetail = {
  aucIncDurationSecs?: Maybe<Array<Maybe<Scalars['String']>>>;
  aucMinIncrementPct?: Maybe<Array<Maybe<Scalars['String']>>>;
  bidIncentivePct?: Maybe<Array<Maybe<Scalars['String']>>>;
  dataReplacement?: Maybe<Scalars['String']>;
  executionDelegate?: Maybe<Scalars['String']>;
  fees?: Maybe<Array<Maybe<TxX2Y2Fee>>>;
  itemHash?: Maybe<Scalars['String']>;
  itemIdx?: Maybe<Array<Maybe<Scalars['String']>>>;
  op?: Maybe<Array<Maybe<Scalars['String']>>>;
  orderIdx?: Maybe<Array<Maybe<Scalars['String']>>>;
  price?: Maybe<Array<Maybe<Scalars['String']>>>;
};

export type UnsetLikeInput = {
  likedById: Scalars['String'];
  likedId: Scalars['String'];
  likedType: LikeableType;
};

export type UpdateAssociatedAddressesInput = {
  chainId?: InputMaybe<Scalars['String']>;
  profileUrl: Scalars['String'];
};

export type UpdateAssociatedAddressesOutput = {
  message?: Maybe<Scalars['String']>;
};

export type UpdateAssociatedContractInput = {
  chainId?: InputMaybe<Scalars['String']>;
  profileUrl: Scalars['String'];
};

export type UpdateAssociatedContractOutput = {
  message?: Maybe<Scalars['String']>;
};

export type UpdateCacheInput = {
  expireSeconds?: InputMaybe<Scalars['Int']>;
  key: Scalars['String'];
  value: Scalars['String'];
};

export type UpdateCacheOutput = {
  message?: Maybe<Scalars['String']>;
};

export type UpdateCollectionImageUrlsOutput = {
  message?: Maybe<Scalars['String']>;
};

export type UpdateCollectionNameOutput = {
  message?: Maybe<Scalars['String']>;
};

export type UpdateCurationInput = {
  id: Scalars['ID'];
  items: Array<CurationItemInput>;
};

export type UpdateEmailInput = {
  email: Scalars['String'];
};

export type UpdateHiddenInput = {
  eventIdArray?: InputMaybe<Array<Scalars['String']>>;
  hidden: Scalars['Boolean'];
};

export type UpdateHiddenOutput = {
  message?: Maybe<Scalars['String']>;
};

export type UpdateHideIgnoredInput = {
  eventIdArray?: InputMaybe<Array<Scalars['String']>>;
  hideIgnored: Scalars['Boolean'];
};

export type UpdateHideIgnoredOutput = {
  message?: Maybe<Scalars['String']>;
};

export type UpdateNFTInput = {
  chainId?: InputMaybe<Scalars['String']>;
  contract: Scalars['String'];
  tokenId: Scalars['String'];
};

export type UpdateNFTsForProfileInput = {
  chainId?: InputMaybe<Scalars['String']>;
  pageInput?: InputMaybe<PageInput>;
  profileId: Scalars['ID'];
  query?: InputMaybe<Scalars['String']>;
};

export type UpdateOfficialCollectionsOutput = {
  message?: Maybe<Scalars['String']>;
};

export type UpdateProfileInput = {
  associatedContract?: InputMaybe<Scalars['Address']>;
  bannerURL?: InputMaybe<Scalars['String']>;
  deployedContractsVisible?: InputMaybe<Scalars['Boolean']>;
  description?: InputMaybe<Scalars['String']>;
  displayType?: InputMaybe<ProfileDisplayType>;
  gkIconVisible?: InputMaybe<Scalars['Boolean']>;
  hideAllNFTs?: InputMaybe<Scalars['Boolean']>;
  hideCustomization?: InputMaybe<Scalars['Boolean']>;
  hideNFTIds?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  id: Scalars['ID'];
  layoutType?: InputMaybe<ProfileLayoutType>;
  nftsDescriptionsVisible?: InputMaybe<Scalars['Boolean']>;
  photoURL?: InputMaybe<Scalars['String']>;
  showAllNFTs?: InputMaybe<Scalars['Boolean']>;
  showNFTIds?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
};

export type UpdateProfileViewInput = {
  profileViewType: ProfileViewType;
  url: Scalars['String'];
};

export type UpdateReadOutput = {
  idsNotFoundOrFailed: Array<Maybe<Scalars['String']>>;
  updatedIdsSuccess: Array<Maybe<Scalars['String']>>;
};

export type UpdateSpamStatusOutput = {
  message?: Maybe<Scalars['String']>;
};

export type UpdateUserInput = {
  avatarURL?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['String']>;
  preferences?: InputMaybe<UserPreferencesInput>;
};

export type UploadMetadataImagesToS3Output = {
  message?: Maybe<Scalars['String']>;
};

export type UploadProfileImagesInput = {
  avatar?: InputMaybe<Scalars['Upload']>;
  banner?: InputMaybe<Scalars['Upload']>;
  compositeProfileURL: Scalars['Boolean'];
  description?: InputMaybe<Scalars['String']>;
  profileId: Scalars['ID'];
};

export type User = {
  avatarURL?: Maybe<Scalars['String']>;
  chainId?: Maybe<Scalars['String']>;
  email?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  isEmailConfirmed: Scalars['Boolean'];
  myAddresses?: Maybe<Array<Wallet>>;
  myApprovals?: Maybe<Array<Approval>>;
  preferences: UserPreferences;
  profilesActionsWithPoints?: Maybe<Array<Maybe<ProfilesActionsOutput>>>;
  referralId: Scalars['String'];
  referredBy?: Maybe<Scalars['String']>;
  username?: Maybe<Scalars['String']>;
};

export type UserPreferences = {
  bidActivityNotifications?: Maybe<Scalars['Boolean']>;
  outbidNotifications?: Maybe<Scalars['Boolean']>;
  priceChangeNotifications?: Maybe<Scalars['Boolean']>;
  promotionalNotifications?: Maybe<Scalars['Boolean']>;
  purchaseSuccessNotifications?: Maybe<Scalars['Boolean']>;
};

export type UserPreferencesInput = {
  bidActivityNotifications?: InputMaybe<Scalars['Boolean']>;
  outbidNotifications?: InputMaybe<Scalars['Boolean']>;
  priceChangeNotifications?: InputMaybe<Scalars['Boolean']>;
  promotionalNotifications?: InputMaybe<Scalars['Boolean']>;
  purchaseSuccessNotifications?: InputMaybe<Scalars['Boolean']>;
};

export type UserSwapsInput = {
  pageInput?: InputMaybe<PageInput>;
  participant: Scalars['Address'];
};

export type UsersActionOutput = {
  action?: Maybe<Array<Maybe<ProfileActionType>>>;
  totalPoints?: Maybe<Scalars['Int']>;
  userId?: Maybe<Scalars['String']>;
};

export type ValidateProfileGkOwners = {
  gkIconVisible?: Maybe<Scalars['Boolean']>;
  id: Scalars['String'];
};

export enum ViewableType {
  Collection = 'Collection',
  NFT = 'NFT',
  Profile = 'Profile'
}

export enum ViewerType {
  ProfileHolder = 'ProfileHolder',
  User = 'User',
  Visitor = 'Visitor'
}

export type Wallet = {
  address: Scalars['Address'];
  chainId: Scalars['String'];
  chainName: Scalars['String'];
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  network: Scalars['String'];
  preferredProfile?: Maybe<Profile>;
  profileId?: Maybe<Scalars['String']>;
  user?: Maybe<User>;
};

export type WalletInput = {
  address: Scalars['Address'];
  chainId: Scalars['String'];
  network: Scalars['String'];
};

export type Watchlist = {
  collectionItems: Array<Collection>;
  nftItems: Array<NFT>;
  profileItems: Array<Profile>;
};

export type WatchlistInput = {
  itemId: Scalars['ID'];
  itemType: WatchlistItemType;
  userId: Scalars['ID'];
};

export enum WatchlistItemType {
  Collection = 'Collection',
  NFT = 'NFT',
  Profile = 'Profile'
}

export type WhitelistCheckInput = {
  address: Scalars['Address'];
};

export type X2Y2ProtocolData = {
  amount?: Maybe<Scalars['Int']>;
  contract?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['Int']>;
  currencyAddress?: Maybe<Scalars['String']>;
  end_at?: Maybe<Scalars['Int']>;
  erc_type?: Maybe<Scalars['Int']>;
  id?: Maybe<Scalars['Int']>;
  is_bundle?: Maybe<Scalars['Boolean']>;
  is_collection_offer?: Maybe<Scalars['Boolean']>;
  is_private?: Maybe<Scalars['Boolean']>;
  maker?: Maybe<Scalars['String']>;
  price?: Maybe<Scalars['String']>;
  royalty_fee?: Maybe<Scalars['Int']>;
  side?: Maybe<Scalars['Int']>;
  status?: Maybe<Scalars['String']>;
  tokenId?: Maybe<Scalars['String']>;
  type?: Maybe<Scalars['String']>;
  updated_at?: Maybe<Scalars['Int']>;
};

export type SaveCollectionForContractOutput = {
  message?: Maybe<Scalars['String']>;
};

export type UpdateEnsnftMetadataOutput = {
  message?: Maybe<Scalars['String']>;
};
