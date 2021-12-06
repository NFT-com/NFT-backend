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

export type Bid = {
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  nftType: NftType;
  price: Scalars['Uint256'];
  profile?: Maybe<Profile>;
  signature: Signature;
  stakeWeightedSeconds?: Maybe<Scalars['Int']>;
  status: BidStatus;
  updatedAt: Scalars['DateTime'];
  wallet?: Maybe<Wallet>;
};

export type BidInput = {
  nftType: NftType;
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
  pageInput?: InputMaybe<PageInput>;
  profileId?: InputMaybe<Scalars['ID']>;
  walletId?: InputMaybe<Scalars['ID']>;
};

export type BidsOutput = {
  items: Array<Bid>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type FileUploadOutput = {
  accessKey: Scalars['String'];
  bucket: Scalars['String'];
  secretKey: Scalars['String'];
  sessionToken: Scalars['String'];
};

export type FollowersInput = {
  pageInput?: InputMaybe<PageInput>;
  profileId: Scalars['ID'];
};

export type FollowersOutput = {
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
  wallets: Array<Wallet>;
};

export type Mutation = {
  addAddress: Wallet;
  approveAmount: Approval;
  bid: Bid;
  cancelBid: Scalars['Boolean'];
  confirmEmail: Scalars['Boolean'];
  followProfile: Profile;
  resendEmailConfirm: User;
  signUp: User;
  unfollowProfile: Profile;
  updateMe: User;
  updateProfile: Profile;
  uploadFileSession: FileUploadOutput;
};


export type MutationAddAddressArgs = {
  input: WalletInput;
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


export type MutationConfirmEmailArgs = {
  token: Scalars['String'];
};


export type MutationFollowProfileArgs = {
  url?: InputMaybe<Scalars['String']>;
};


export type MutationSignUpArgs = {
  input: SignUpInput;
};


export type MutationUnfollowProfileArgs = {
  id: Scalars['ID'];
};


export type MutationUpdateMeArgs = {
  input: UpdateUserInput;
};


export type MutationUpdateProfileArgs = {
  input: UpdateProfileInput;
};

export type Nft = {
  contract?: Maybe<Scalars['String']>;
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  isOwnedByMe?: Maybe<Scalars['Boolean']>;
  metadata: NftMetadata;
  price: Scalars['Uint256'];
  type: NftType;
  wallet?: Maybe<Wallet>;
};

export type NftMetadata = {
  description?: Maybe<Scalars['String']>;
  imageURL?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  tokenId: Scalars['String'];
  txHash: Scalars['String'];
};

export enum NftType {
  Erc721 = 'ERC721',
  Erc1155 = 'ERC1155',
  Profile = 'Profile'
}

export type NfTsInput = {
  pageInput?: InputMaybe<PageInput>;
  profileId?: InputMaybe<Scalars['ID']>;
  types?: InputMaybe<Array<NftType>>;
};

export type NfTsOutput = {
  nfts: Array<Nft>;
  pageInfo?: Maybe<PageInfo>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type PageInfo = {
  firstCursor?: Maybe<Scalars['String']>;
  lastCursor?: Maybe<Scalars['String']>;
};

export type PageInput = {
  afterCursor?: InputMaybe<Scalars['String']>;
  beforeCursor?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};

export type Profile = {
  bannerURL?: Maybe<Scalars['String']>;
  createdAt: Scalars['DateTime'];
  description?: Maybe<Scalars['String']>;
  followersCount?: Maybe<Scalars['Int']>;
  id: Scalars['ID'];
  isFollowedByMe?: Maybe<Scalars['Boolean']>;
  isOwnedByMe?: Maybe<Scalars['Boolean']>;
  owner?: Maybe<Wallet>;
  photoURL?: Maybe<Scalars['String']>;
  status?: Maybe<ProfileStatus>;
  url: Scalars['String'];
  winningBid?: Maybe<Bid>;
};

export enum ProfileStatus {
  Available = 'Available',
  Owned = 'Owned',
  Pending = 'Pending'
}

export type ProfilesInput = {
  pageInput?: InputMaybe<PageInput>;
  statuses?: InputMaybe<Array<InputMaybe<ProfileStatus>>>;
};

export type ProfilesOutput = {
  pageInfo?: Maybe<PageInfo>;
  profiles: Array<Profile>;
  totalItems?: Maybe<Scalars['Int']>;
};

export type Query = {
  bids: BidsOutput;
  me: User;
  myBids: BidsOutput;
  myNFTs: NfTsOutput;
  myProfiles: ProfilesOutput;
  nft: Nft;
  nfts: NfTsOutput;
  profile: Profile;
  profileFollowers: FollowersOutput;
  profilesFollowedByMe: ProfilesOutput;
  topBids: BidsOutput;
};


export type QueryBidsArgs = {
  input?: InputMaybe<BidsInput>;
};


export type QueryMyBidsArgs = {
  input?: InputMaybe<BidsInput>;
};


export type QueryMyNfTsArgs = {
  input?: InputMaybe<NfTsInput>;
};


export type QueryMyProfilesArgs = {
  input?: InputMaybe<ProfilesInput>;
};


export type QueryNftArgs = {
  id: Scalars['ID'];
};


export type QueryNftsArgs = {
  input?: InputMaybe<NfTsInput>;
};


export type QueryProfileArgs = {
  url: Scalars['String'];
};


export type QueryProfileFollowersArgs = {
  input: FollowersInput;
};


export type QueryProfilesFollowedByMeArgs = {
  input?: InputMaybe<ProfilesInput>;
};


export type QueryTopBidsArgs = {
  input?: InputMaybe<TopBidsInput>;
};

export type SignUpInput = {
  avatarURL?: InputMaybe<Scalars['String']>;
  email: Scalars['String'];
  referredBy?: InputMaybe<Scalars['String']>;
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

export type TopBidsInput = {
  pageInput?: InputMaybe<PageInput>;
  profileId?: InputMaybe<Scalars['ID']>;
};

export type UpdateProfileInput = {
  bannedURL?: InputMaybe<Scalars['String']>;
  description?: InputMaybe<Scalars['String']>;
  id: Scalars['ID'];
  photoURL?: InputMaybe<Scalars['String']>;
};

export type UpdateUserInput = {
  avatarURL?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['String']>;
  preferences?: InputMaybe<UserPreferencesInput>;
};

export type User = {
  avatarURL?: Maybe<Scalars['String']>;
  email: Scalars['String'];
  id: Scalars['ID'];
  isEmailConfirmed: Scalars['Boolean'];
  myAddresses?: Maybe<Array<Wallet>>;
  myApprovals?: Maybe<Array<Approval>>;
  preferences: UserPreferences;
  referralId: Scalars['String'];
  referredBy?: Maybe<Scalars['String']>;
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

export type Wallet = {
  address: Scalars['Address'];
  chainId: Scalars['String'];
  chainName: Scalars['String'];
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  network: Scalars['String'];
  user?: Maybe<User>;
};

export type WalletInput = {
  address: Scalars['Address'];
  chainId: Scalars['String'];
  network: Scalars['String'];
};
