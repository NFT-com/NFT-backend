/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PayableOverrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import { FunctionFragment, Result, EventFragment } from "@ethersproject/abi";
import { Listener, Provider } from "@ethersproject/providers";
import { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";

export declare namespace ProfileAuctionV2 {
  export type MintArgsStruct = {
    _nftTokens: BigNumberish;
    _genKey: boolean;
    _profileURI: string;
    _owner: string;
    v: BigNumberish;
    r: BytesLike;
    s: BytesLike;
    nftV: BigNumberish;
    nftR: BytesLike;
    nftS: BytesLike;
  };

  export type MintArgsStructOutput = [
    BigNumber,
    boolean,
    string,
    string,
    number,
    string,
    string,
    number,
    string,
    string
  ] & {
    _nftTokens: BigNumber;
    _genKey: boolean;
    _profileURI: string;
    _owner: string;
    v: number;
    r: string;
    s: string;
    nftV: number;
    nftR: string;
    nftS: string;
  };
}

export interface ProfileAuctionInterface extends utils.Interface {
  contractName: "ProfileAuction";
  functions: {
    "addProfilesToMint(uint256)": FunctionFragment;
    "approveBid(uint256,bool,string,address)": FunctionFragment;
    "approvedBids(bytes32)": FunctionFragment;
    "cancelBid(uint256,bool,string,address,uint8,bytes32,bytes32)": FunctionFragment;
    "cancelledOrFinalized(bytes32)": FunctionFragment;
    "claimProfile(uint256,bool,string,address,uint8,bytes32,bytes32)": FunctionFragment;
    "claimableBlock(bytes32)": FunctionFragment;
    "coldWallet()": FunctionFragment;
    "genesisKeyContract()": FunctionFragment;
    "genesisKeyPercent()": FunctionFragment;
    "genesisStakingContract()": FunctionFragment;
    "getStructHash(uint256,bool,string,address)": FunctionFragment;
    "governor()": FunctionFragment;
    "initialize(address,address,address,address,address,address,address,address,address)": FunctionFragment;
    "minimumBid()": FunctionFragment;
    "mintProfileFor((uint256,bool,string,address,uint8,bytes32,bytes32,uint8,bytes32,bytes32)[])": FunctionFragment;
    "minter()": FunctionFragment;
    "nftErc20Contract()": FunctionFragment;
    "nftProfile()": FunctionFragment;
    "nftProfileHelperAddress()": FunctionFragment;
    "owner()": FunctionFragment;
    "payOutNftTokens()": FunctionFragment;
    "profilesToMint()": FunctionFragment;
    "publicPoolPercent()": FunctionFragment;
    "publicStakingContract()": FunctionFragment;
    "setMinimumBid(uint256)": FunctionFragment;
    "setOwner(address)": FunctionFragment;
    "upgradeTo(address)": FunctionFragment;
    "upgradeToAndCall(address,bytes)": FunctionFragment;
    "validateBid(uint256,bool,string,address,uint8,bytes32,bytes32)": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "addProfilesToMint",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "approveBid",
    values: [BigNumberish, boolean, string, string]
  ): string;
  encodeFunctionData(
    functionFragment: "approvedBids",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "cancelBid",
    values: [
      BigNumberish,
      boolean,
      string,
      string,
      BigNumberish,
      BytesLike,
      BytesLike
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "cancelledOrFinalized",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "claimProfile",
    values: [
      BigNumberish,
      boolean,
      string,
      string,
      BigNumberish,
      BytesLike,
      BytesLike
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "claimableBlock",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "coldWallet",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "genesisKeyContract",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "genesisKeyPercent",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "genesisStakingContract",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getStructHash",
    values: [BigNumberish, boolean, string, string]
  ): string;
  encodeFunctionData(functionFragment: "governor", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "initialize",
    values: [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "minimumBid",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "mintProfileFor",
    values: [ProfileAuctionV2.MintArgsStruct[]]
  ): string;
  encodeFunctionData(functionFragment: "minter", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "nftErc20Contract",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "nftProfile",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "nftProfileHelperAddress",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "owner", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "payOutNftTokens",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "profilesToMint",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "publicPoolPercent",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "publicStakingContract",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "setMinimumBid",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(functionFragment: "setOwner", values: [string]): string;
  encodeFunctionData(functionFragment: "upgradeTo", values: [string]): string;
  encodeFunctionData(
    functionFragment: "upgradeToAndCall",
    values: [string, BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "validateBid",
    values: [
      BigNumberish,
      boolean,
      string,
      string,
      BigNumberish,
      BytesLike,
      BytesLike
    ]
  ): string;

  decodeFunctionResult(
    functionFragment: "addProfilesToMint",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "approveBid", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "approvedBids",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "cancelBid", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "cancelledOrFinalized",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "claimProfile",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "claimableBlock",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "coldWallet", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "genesisKeyContract",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "genesisKeyPercent",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "genesisStakingContract",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getStructHash",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "governor", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "initialize", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "minimumBid", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "mintProfileFor",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "minter", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "nftErc20Contract",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "nftProfile", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "nftProfileHelperAddress",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "owner", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "payOutNftTokens",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "profilesToMint",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "publicPoolPercent",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "publicStakingContract",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setMinimumBid",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "setOwner", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "upgradeTo", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "upgradeToAndCall",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "validateBid",
    data: BytesLike
  ): Result;

  events: {
    "AdminChanged(address,address)": EventFragment;
    "BeaconUpgraded(address)": EventFragment;
    "BidCancelled(bytes32)": EventFragment;
    "MintedProfile(address,string,uint256,uint256)": EventFragment;
    "NewBid(address,bool,string,uint256)": EventFragment;
    "NewClaimableProfile(address,bool,string,uint256,uint256)": EventFragment;
    "RedeemProfile(address,string,uint256,uint256,uint256)": EventFragment;
    "Upgraded(address)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "AdminChanged"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "BeaconUpgraded"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "BidCancelled"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "MintedProfile"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "NewBid"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "NewClaimableProfile"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "RedeemProfile"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "Upgraded"): EventFragment;
}

export type AdminChangedEvent = TypedEvent<
  [string, string],
  { previousAdmin: string; newAdmin: string }
>;

export type AdminChangedEventFilter = TypedEventFilter<AdminChangedEvent>;

export type BeaconUpgradedEvent = TypedEvent<[string], { beacon: string }>;

export type BeaconUpgradedEventFilter = TypedEventFilter<BeaconUpgradedEvent>;

export type BidCancelledEvent = TypedEvent<[string], { hash: string }>;

export type BidCancelledEventFilter = TypedEventFilter<BidCancelledEvent>;

export type MintedProfileEvent = TypedEvent<
  [string, string, BigNumber, BigNumber],
  { _user: string; _val: string; _amount: BigNumber; _blockNum: BigNumber }
>;

export type MintedProfileEventFilter = TypedEventFilter<MintedProfileEvent>;

export type NewBidEvent = TypedEvent<
  [string, boolean, string, BigNumber],
  { _user: string; _genKey: boolean; _val: string; _amount: BigNumber }
>;

export type NewBidEventFilter = TypedEventFilter<NewBidEvent>;

export type NewClaimableProfileEvent = TypedEvent<
  [string, boolean, string, BigNumber, BigNumber],
  {
    _user: string;
    _genKey: boolean;
    _val: string;
    _amount: BigNumber;
    _blockNum: BigNumber;
  }
>;

export type NewClaimableProfileEventFilter =
  TypedEventFilter<NewClaimableProfileEvent>;

export type RedeemProfileEvent = TypedEvent<
  [string, string, BigNumber, BigNumber, BigNumber],
  {
    _user: string;
    _val: string;
    _block: BigNumber;
    _amount: BigNumber;
    _tokenId: BigNumber;
  }
>;

export type RedeemProfileEventFilter = TypedEventFilter<RedeemProfileEvent>;

export type UpgradedEvent = TypedEvent<[string], { implementation: string }>;

export type UpgradedEventFilter = TypedEventFilter<UpgradedEvent>;

export interface ProfileAuction extends BaseContract {
  contractName: "ProfileAuction";
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: ProfileAuctionInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    addProfilesToMint(
      _profilesToMint: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    approveBid(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    approvedBids(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<[boolean]>;

    cancelBid(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    cancelledOrFinalized(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<[boolean]>;

    claimProfile(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    claimableBlock(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;

    coldWallet(overrides?: CallOverrides): Promise<[string]>;

    genesisKeyContract(overrides?: CallOverrides): Promise<[string]>;

    genesisKeyPercent(overrides?: CallOverrides): Promise<[BigNumber]>;

    genesisStakingContract(overrides?: CallOverrides): Promise<[string]>;

    getStructHash(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      overrides?: CallOverrides
    ): Promise<[string]>;

    governor(overrides?: CallOverrides): Promise<[string]>;

    initialize(
      _nftErc20Contract: string,
      _minter: string,
      _nftProfile: string,
      _governor: string,
      _nftProfileHelperAddress: string,
      _coldWallet: string,
      _genesisKeyContract: string,
      _genesisStakingContract: string,
      _publicStakingContract: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    minimumBid(overrides?: CallOverrides): Promise<[BigNumber]>;

    mintProfileFor(
      mintArgs: ProfileAuctionV2.MintArgsStruct[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    minter(overrides?: CallOverrides): Promise<[string]>;

    nftErc20Contract(overrides?: CallOverrides): Promise<[string]>;

    nftProfile(overrides?: CallOverrides): Promise<[string]>;

    nftProfileHelperAddress(overrides?: CallOverrides): Promise<[string]>;

    owner(overrides?: CallOverrides): Promise<[string]>;

    payOutNftTokens(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    profilesToMint(overrides?: CallOverrides): Promise<[BigNumber]>;

    publicPoolPercent(overrides?: CallOverrides): Promise<[BigNumber]>;

    publicStakingContract(overrides?: CallOverrides): Promise<[string]>;

    setMinimumBid(
      _newBid: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setOwner(
      _new: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    upgradeTo(
      newImplementation: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    upgradeToAndCall(
      newImplementation: string,
      data: BytesLike,
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    validateBid(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      overrides?: CallOverrides
    ): Promise<[boolean]>;
  };

  addProfilesToMint(
    _profilesToMint: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  approveBid(
    _nftTokens: BigNumberish,
    _genKey: boolean,
    _profileURI: string,
    _owner: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  approvedBids(arg0: BytesLike, overrides?: CallOverrides): Promise<boolean>;

  cancelBid(
    _nftTokens: BigNumberish,
    _genKey: boolean,
    _profileURI: string,
    _owner: string,
    v: BigNumberish,
    r: BytesLike,
    s: BytesLike,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  cancelledOrFinalized(
    arg0: BytesLike,
    overrides?: CallOverrides
  ): Promise<boolean>;

  claimProfile(
    _nftTokens: BigNumberish,
    _genKey: boolean,
    _profileURI: string,
    _owner: string,
    v: BigNumberish,
    r: BytesLike,
    s: BytesLike,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  claimableBlock(
    arg0: BytesLike,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  coldWallet(overrides?: CallOverrides): Promise<string>;

  genesisKeyContract(overrides?: CallOverrides): Promise<string>;

  genesisKeyPercent(overrides?: CallOverrides): Promise<BigNumber>;

  genesisStakingContract(overrides?: CallOverrides): Promise<string>;

  getStructHash(
    _nftTokens: BigNumberish,
    _genKey: boolean,
    _profileURI: string,
    _owner: string,
    overrides?: CallOverrides
  ): Promise<string>;

  governor(overrides?: CallOverrides): Promise<string>;

  initialize(
    _nftErc20Contract: string,
    _minter: string,
    _nftProfile: string,
    _governor: string,
    _nftProfileHelperAddress: string,
    _coldWallet: string,
    _genesisKeyContract: string,
    _genesisStakingContract: string,
    _publicStakingContract: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  minimumBid(overrides?: CallOverrides): Promise<BigNumber>;

  mintProfileFor(
    mintArgs: ProfileAuctionV2.MintArgsStruct[],
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  minter(overrides?: CallOverrides): Promise<string>;

  nftErc20Contract(overrides?: CallOverrides): Promise<string>;

  nftProfile(overrides?: CallOverrides): Promise<string>;

  nftProfileHelperAddress(overrides?: CallOverrides): Promise<string>;

  owner(overrides?: CallOverrides): Promise<string>;

  payOutNftTokens(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  profilesToMint(overrides?: CallOverrides): Promise<BigNumber>;

  publicPoolPercent(overrides?: CallOverrides): Promise<BigNumber>;

  publicStakingContract(overrides?: CallOverrides): Promise<string>;

  setMinimumBid(
    _newBid: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setOwner(
    _new: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  upgradeTo(
    newImplementation: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  upgradeToAndCall(
    newImplementation: string,
    data: BytesLike,
    overrides?: PayableOverrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  validateBid(
    _nftTokens: BigNumberish,
    _genKey: boolean,
    _profileURI: string,
    _owner: string,
    v: BigNumberish,
    r: BytesLike,
    s: BytesLike,
    overrides?: CallOverrides
  ): Promise<boolean>;

  callStatic: {
    addProfilesToMint(
      _profilesToMint: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    approveBid(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      overrides?: CallOverrides
    ): Promise<void>;

    approvedBids(arg0: BytesLike, overrides?: CallOverrides): Promise<boolean>;

    cancelBid(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      overrides?: CallOverrides
    ): Promise<void>;

    cancelledOrFinalized(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<boolean>;

    claimProfile(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      overrides?: CallOverrides
    ): Promise<void>;

    claimableBlock(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    coldWallet(overrides?: CallOverrides): Promise<string>;

    genesisKeyContract(overrides?: CallOverrides): Promise<string>;

    genesisKeyPercent(overrides?: CallOverrides): Promise<BigNumber>;

    genesisStakingContract(overrides?: CallOverrides): Promise<string>;

    getStructHash(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      overrides?: CallOverrides
    ): Promise<string>;

    governor(overrides?: CallOverrides): Promise<string>;

    initialize(
      _nftErc20Contract: string,
      _minter: string,
      _nftProfile: string,
      _governor: string,
      _nftProfileHelperAddress: string,
      _coldWallet: string,
      _genesisKeyContract: string,
      _genesisStakingContract: string,
      _publicStakingContract: string,
      overrides?: CallOverrides
    ): Promise<void>;

    minimumBid(overrides?: CallOverrides): Promise<BigNumber>;

    mintProfileFor(
      mintArgs: ProfileAuctionV2.MintArgsStruct[],
      overrides?: CallOverrides
    ): Promise<void>;

    minter(overrides?: CallOverrides): Promise<string>;

    nftErc20Contract(overrides?: CallOverrides): Promise<string>;

    nftProfile(overrides?: CallOverrides): Promise<string>;

    nftProfileHelperAddress(overrides?: CallOverrides): Promise<string>;

    owner(overrides?: CallOverrides): Promise<string>;

    payOutNftTokens(overrides?: CallOverrides): Promise<void>;

    profilesToMint(overrides?: CallOverrides): Promise<BigNumber>;

    publicPoolPercent(overrides?: CallOverrides): Promise<BigNumber>;

    publicStakingContract(overrides?: CallOverrides): Promise<string>;

    setMinimumBid(
      _newBid: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    setOwner(_new: string, overrides?: CallOverrides): Promise<void>;

    upgradeTo(
      newImplementation: string,
      overrides?: CallOverrides
    ): Promise<void>;

    upgradeToAndCall(
      newImplementation: string,
      data: BytesLike,
      overrides?: CallOverrides
    ): Promise<void>;

    validateBid(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      overrides?: CallOverrides
    ): Promise<boolean>;
  };

  filters: {
    "AdminChanged(address,address)"(
      previousAdmin?: null,
      newAdmin?: null
    ): AdminChangedEventFilter;
    AdminChanged(
      previousAdmin?: null,
      newAdmin?: null
    ): AdminChangedEventFilter;

    "BeaconUpgraded(address)"(
      beacon?: string | null
    ): BeaconUpgradedEventFilter;
    BeaconUpgraded(beacon?: string | null): BeaconUpgradedEventFilter;

    "BidCancelled(bytes32)"(hash?: BytesLike | null): BidCancelledEventFilter;
    BidCancelled(hash?: BytesLike | null): BidCancelledEventFilter;

    "MintedProfile(address,string,uint256,uint256)"(
      _user?: null,
      _val?: null,
      _amount?: null,
      _blockNum?: null
    ): MintedProfileEventFilter;
    MintedProfile(
      _user?: null,
      _val?: null,
      _amount?: null,
      _blockNum?: null
    ): MintedProfileEventFilter;

    "NewBid(address,bool,string,uint256)"(
      _user?: null,
      _genKey?: null,
      _val?: null,
      _amount?: null
    ): NewBidEventFilter;
    NewBid(
      _user?: null,
      _genKey?: null,
      _val?: null,
      _amount?: null
    ): NewBidEventFilter;

    "NewClaimableProfile(address,bool,string,uint256,uint256)"(
      _user?: null,
      _genKey?: null,
      _val?: null,
      _amount?: null,
      _blockNum?: null
    ): NewClaimableProfileEventFilter;
    NewClaimableProfile(
      _user?: null,
      _genKey?: null,
      _val?: null,
      _amount?: null,
      _blockNum?: null
    ): NewClaimableProfileEventFilter;

    "RedeemProfile(address,string,uint256,uint256,uint256)"(
      _user?: null,
      _val?: null,
      _block?: null,
      _amount?: null,
      _tokenId?: null
    ): RedeemProfileEventFilter;
    RedeemProfile(
      _user?: null,
      _val?: null,
      _block?: null,
      _amount?: null,
      _tokenId?: null
    ): RedeemProfileEventFilter;

    "Upgraded(address)"(implementation?: string | null): UpgradedEventFilter;
    Upgraded(implementation?: string | null): UpgradedEventFilter;
  };

  estimateGas: {
    addProfilesToMint(
      _profilesToMint: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    approveBid(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    approvedBids(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    cancelBid(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    cancelledOrFinalized(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    claimProfile(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    claimableBlock(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    coldWallet(overrides?: CallOverrides): Promise<BigNumber>;

    genesisKeyContract(overrides?: CallOverrides): Promise<BigNumber>;

    genesisKeyPercent(overrides?: CallOverrides): Promise<BigNumber>;

    genesisStakingContract(overrides?: CallOverrides): Promise<BigNumber>;

    getStructHash(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    governor(overrides?: CallOverrides): Promise<BigNumber>;

    initialize(
      _nftErc20Contract: string,
      _minter: string,
      _nftProfile: string,
      _governor: string,
      _nftProfileHelperAddress: string,
      _coldWallet: string,
      _genesisKeyContract: string,
      _genesisStakingContract: string,
      _publicStakingContract: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    minimumBid(overrides?: CallOverrides): Promise<BigNumber>;

    mintProfileFor(
      mintArgs: ProfileAuctionV2.MintArgsStruct[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    minter(overrides?: CallOverrides): Promise<BigNumber>;

    nftErc20Contract(overrides?: CallOverrides): Promise<BigNumber>;

    nftProfile(overrides?: CallOverrides): Promise<BigNumber>;

    nftProfileHelperAddress(overrides?: CallOverrides): Promise<BigNumber>;

    owner(overrides?: CallOverrides): Promise<BigNumber>;

    payOutNftTokens(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    profilesToMint(overrides?: CallOverrides): Promise<BigNumber>;

    publicPoolPercent(overrides?: CallOverrides): Promise<BigNumber>;

    publicStakingContract(overrides?: CallOverrides): Promise<BigNumber>;

    setMinimumBid(
      _newBid: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setOwner(
      _new: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    upgradeTo(
      newImplementation: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    upgradeToAndCall(
      newImplementation: string,
      data: BytesLike,
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    validateBid(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    addProfilesToMint(
      _profilesToMint: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    approveBid(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    approvedBids(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    cancelBid(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    cancelledOrFinalized(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    claimProfile(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    claimableBlock(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    coldWallet(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    genesisKeyContract(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    genesisKeyPercent(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    genesisStakingContract(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getStructHash(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    governor(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    initialize(
      _nftErc20Contract: string,
      _minter: string,
      _nftProfile: string,
      _governor: string,
      _nftProfileHelperAddress: string,
      _coldWallet: string,
      _genesisKeyContract: string,
      _genesisStakingContract: string,
      _publicStakingContract: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    minimumBid(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    mintProfileFor(
      mintArgs: ProfileAuctionV2.MintArgsStruct[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    minter(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    nftErc20Contract(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    nftProfile(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    nftProfileHelperAddress(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    owner(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    payOutNftTokens(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    profilesToMint(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    publicPoolPercent(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    publicStakingContract(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    setMinimumBid(
      _newBid: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setOwner(
      _new: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    upgradeTo(
      newImplementation: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    upgradeToAndCall(
      newImplementation: string,
      data: BytesLike,
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    validateBid(
      _nftTokens: BigNumberish,
      _genKey: boolean,
      _profileURI: string,
      _owner: string,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}
