# Schema Types

<details>
  <summary><strong>Table of Contents</strong></summary>

  * [Query](#query)
  * [Mutation](#mutation)
  * [Objects](#objects)
    * [Approval](#approval)
    * [AssetType](#assettype)
    * [Bid](#bid)
    * [BidsOutput](#bidsoutput)
    * [Collection](#collection)
    * [Curation](#curation)
    * [CurationItem](#curationitem)
    * [CurationNFT](#curationnft)
    * [CurationNFTsOutput](#curationnftsoutput)
    * [CurationsOutput](#curationsoutput)
    * [EndAuctionOutput](#endauctionoutput)
    * [FileUploadOutput](#fileuploadoutput)
    * [FollowersOutput](#followersoutput)
    * [GetMarketAsk](#getmarketask)
    * [GetMarketBid](#getmarketbid)
    * [GetMarketSwap](#getmarketswap)
    * [MarketAsk](#marketask)
    * [MarketBid](#marketbid)
    * [MarketSwap](#marketswap)
    * [MarketplaceAsset](#marketplaceasset)
    * [NFT](#nft)
    * [NFTMetadata](#nftmetadata)
    * [NFTTrait](#nfttrait)
    * [NFTsOutput](#nftsoutput)
    * [PageInfo](#pageinfo)
    * [Profile](#profile)
    * [ProfilesOutput](#profilesoutput)
    * [RefreshMyNFTsOutput](#refreshmynftsoutput)
    * [Signature](#signature)
    * [User](#user)
    * [UserPreferences](#userpreferences)
    * [Wallet](#wallet)
  * [Inputs](#inputs)
    * [ApprovalInput](#approvalinput)
    * [AsksInput](#asksinput)
    * [AssetTypeInput](#assettypeinput)
    * [BidInput](#bidinput)
    * [BidsInput](#bidsinput)
    * [CollectionInput](#collectioninput)
    * [CollectionNFTsInput](#collectionnftsinput)
    * [CreateAskInput](#createaskinput)
    * [CreateBidInput](#createbidinput)
    * [CreateCurationInput](#createcurationinput)
    * [CurationInput](#curationinput)
    * [CurationItemInput](#curationiteminput)
    * [CurationsInput](#curationsinput)
    * [EndAuctionInput](#endauctioninput)
    * [FollowersInput](#followersinput)
    * [MarketplaceAssetInput](#marketplaceassetinput)
    * [MintGKProfileInput](#mintgkprofileinput)
    * [NFTsInput](#nftsinput)
    * [PageInput](#pageinput)
    * [ProfileClaimedInput](#profileclaimedinput)
    * [ProfilePreferenceInput](#profilepreferenceinput)
    * [ProfilesInput](#profilesinput)
    * [RemoveCurationInput](#removecurationinput)
    * [SetCurationInput](#setcurationinput)
    * [SignUpInput](#signupinput)
    * [SignatureInput](#signatureinput)
    * [SwapsInput](#swapsinput)
    * [TopBidsInput](#topbidsinput)
    * [UpdateCurationInput](#updatecurationinput)
    * [UpdateEmailInput](#updateemailinput)
    * [UpdateProfileInput](#updateprofileinput)
    * [UpdateUserInput](#updateuserinput)
    * [UserPreferencesInput](#userpreferencesinput)
    * [WalletInput](#walletinput)
  * [Enums](#enums)
    * [AssetClass](#assetclass)
    * [BidStatus](#bidstatus)
    * [NFTSize](#nftsize)
    * [NFTType](#nfttype)
    * [ProfileStatus](#profilestatus)
  * [Scalars](#scalars)
    * [Address](#address)
    * [Boolean](#boolean)
    * [Bytes](#bytes)
    * [Date](#date)
    * [DateTime](#datetime)
    * [ID](#id)
    * [Int](#int)
    * [String](#string)
    * [Uint256](#uint256)

</details>

## Query
<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>bids</strong></td>
<td valign="top"><a href="#bidsoutput">BidsOutput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#bidsinput">BidsInput</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>myBids</strong></td>
<td valign="top"><a href="#bidsoutput">BidsOutput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#bidsinput">BidsInput</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>topBids</strong></td>
<td valign="top"><a href="#bidsoutput">BidsOutput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#topbidsinput">TopBidsInput</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>collection</strong></td>
<td valign="top"><a href="#collection">Collection</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#collectioninput">CollectionInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>myCurations</strong></td>
<td valign="top"><a href="#curationsoutput">CurationsOutput</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#curationsinput">CurationsInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>getAsks</strong></td>
<td valign="top"><a href="#getmarketask">GetMarketAsk</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#asksinput">AsksInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>getBids</strong></td>
<td valign="top"><a href="#getmarketbid">GetMarketBid</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#bidsinput">BidsInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>getSwaps</strong></td>
<td valign="top"><a href="#getmarketswap">GetMarketSwap</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#swapsinput">SwapsInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>nft</strong></td>
<td valign="top"><a href="#nft">NFT</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">contract</td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">id</td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>nftById</strong></td>
<td valign="top"><a href="#nft">NFT</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">id</td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>nfts</strong></td>
<td valign="top"><a href="#curationnftsoutput">CurationNFTsOutput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#nftsinput">NFTsInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>myNFTs</strong></td>
<td valign="top"><a href="#nftsoutput">NFTsOutput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#nftsinput">NFTsInput</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>curationNFTs</strong></td>
<td valign="top"><a href="#curationnftsoutput">CurationNFTsOutput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#curationinput">CurationInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>collectionNFTs</strong></td>
<td valign="top"><a href="#nftsoutput">NFTsOutput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#collectionnftsinput">CollectionNFTsInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>profileFollowers</strong></td>
<td valign="top"><a href="#followersoutput">FollowersOutput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#followersinput">FollowersInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>profilesFollowedByMe</strong></td>
<td valign="top"><a href="#profilesoutput">ProfilesOutput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#profilesinput">ProfilesInput</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>myProfiles</strong></td>
<td valign="top"><a href="#profilesoutput">ProfilesOutput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#profilesinput">ProfilesInput</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>profile</strong></td>
<td valign="top"><a href="#profile">Profile</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">url</td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>profilePassive</strong></td>
<td valign="top"><a href="#profile">Profile</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">url</td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>me</strong></td>
<td valign="top"><a href="#user">User</a>!</td>
<td></td>
</tr>
</tbody>
</table>

## Mutation
<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>approveAmount</strong></td>
<td valign="top"><a href="#approval">Approval</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#approvalinput">ApprovalInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>bid</strong></td>
<td valign="top"><a href="#bid">Bid</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#bidinput">BidInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>cancelBid</strong></td>
<td valign="top"><a href="#boolean">Boolean</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">id</td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>setProfilePreferences</strong></td>
<td valign="top">[<a href="#bid">Bid</a>!]!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#profilepreferenceinput">ProfilePreferenceInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>createCuration</strong></td>
<td valign="top"><a href="#curation">Curation</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#createcurationinput">CreateCurationInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>updateCuration</strong></td>
<td valign="top"><a href="#curation">Curation</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#updatecurationinput">UpdateCurationInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>setCuration</strong></td>
<td valign="top"><a href="#profile">Profile</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#setcurationinput">SetCurationInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>removeCuration</strong></td>
<td valign="top"><a href="#profile">Profile</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#removecurationinput">RemoveCurationInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>createAsk</strong></td>
<td valign="top"><a href="#marketask">MarketAsk</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#createaskinput">CreateAskInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>createBid</strong></td>
<td valign="top"><a href="#marketbid">MarketBid</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#createbidinput">CreateBidInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>uploadFileSession</strong></td>
<td valign="top"><a href="#fileuploadoutput">FileUploadOutput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>endProfileAuction</strong></td>
<td valign="top"><a href="#endauctionoutput">EndAuctionOutput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#endauctioninput">EndAuctionInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>endGKBlindAuction</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>refreshMyNFTs</strong></td>
<td valign="top"><a href="#refreshmynftsoutput">RefreshMyNFTsOutput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>followProfile</strong></td>
<td valign="top"><a href="#profile">Profile</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">url</td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>unfollowProfile</strong></td>
<td valign="top"><a href="#profile">Profile</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">id</td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>updateProfile</strong></td>
<td valign="top"><a href="#profile">Profile</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#updateprofileinput">UpdateProfileInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>profileClaimed</strong></td>
<td valign="top"><a href="#profile">Profile</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#profileclaimedinput">ProfileClaimedInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>mintGKProfile</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#mintgkprofileinput">MintGKProfileInput</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>signUp</strong></td>
<td valign="top"><a href="#user">User</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#signupinput">SignUpInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>updateMe</strong></td>
<td valign="top"><a href="#user">User</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#updateuserinput">UpdateUserInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>updateEmail</strong></td>
<td valign="top"><a href="#user">User</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#updateemailinput">UpdateEmailInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>confirmEmail</strong></td>
<td valign="top"><a href="#boolean">Boolean</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">token</td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>resendEmailConfirm</strong></td>
<td valign="top"><a href="#user">User</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>addAddress</strong></td>
<td valign="top"><a href="#wallet">Wallet</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">input</td>
<td valign="top"><a href="#walletinput">WalletInput</a>!</td>
<td></td>
</tr>
</tbody>
</table>

## Objects

### Approval

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>id</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>amount</strong></td>
<td valign="top"><a href="#uint256">Uint256</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>currency</strong></td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>deadline</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>nonce</strong></td>
<td valign="top"><a href="#int">Int</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>signature</strong></td>
<td valign="top"><a href="#signature">Signature</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>txHash</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>wallet</strong></td>
<td valign="top"><a href="#wallet">Wallet</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>spender</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>createdAt</strong></td>
<td valign="top"><a href="#datetime">DateTime</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### AssetType

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>assetClass</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>bytes</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>contractAddress</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>tokenId</strong></td>
<td valign="top"><a href="#uint256">Uint256</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>allowAll</strong></td>
<td valign="top"><a href="#boolean">Boolean</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### Bid

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>id</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>nftType</strong></td>
<td valign="top"><a href="#nfttype">NFTType</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>price</strong></td>
<td valign="top"><a href="#uint256">Uint256</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>profile</strong></td>
<td valign="top"><a href="#profile">Profile</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>signature</strong></td>
<td valign="top"><a href="#signature">Signature</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>stakeWeightedSeconds</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>status</strong></td>
<td valign="top"><a href="#bidstatus">BidStatus</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>wallet</strong></td>
<td valign="top"><a href="#wallet">Wallet</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>createdAt</strong></td>
<td valign="top"><a href="#datetime">DateTime</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>updatedAt</strong></td>
<td valign="top"><a href="#datetime">DateTime</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### BidsOutput

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>items</strong></td>
<td valign="top">[<a href="#bid">Bid</a>!]!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pageInfo</strong></td>
<td valign="top"><a href="#pageinfo">PageInfo</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>totalItems</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
</tbody>
</table>

### Collection

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>contract</strong></td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>name</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
</tbody>
</table>

### Curation

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>id</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>items</strong></td>
<td valign="top">[<a href="#curationitem">CurationItem</a>!]</td>
<td></td>
</tr>
</tbody>
</table>

### CurationItem

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>size</strong></td>
<td valign="top"><a href="#nftsize">NFTSize</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>id</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### CurationNFT

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>nft</strong></td>
<td valign="top"><a href="#nft">NFT</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>size</strong></td>
<td valign="top"><a href="#nftsize">NFTSize</a></td>
<td></td>
</tr>
</tbody>
</table>

### CurationNFTsOutput

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>items</strong></td>
<td valign="top">[<a href="#curationnft">CurationNFT</a>!]!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pageInfo</strong></td>
<td valign="top"><a href="#pageinfo">PageInfo</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>totalItems</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
</tbody>
</table>

### CurationsOutput

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>items</strong></td>
<td valign="top">[<a href="#curation">Curation</a>!]!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>totalItems</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pageInfo</strong></td>
<td valign="top"><a href="#pageinfo">PageInfo</a></td>
<td></td>
</tr>
</tbody>
</table>

### EndAuctionOutput

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>id</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>price</strong></td>
<td valign="top"><a href="#uint256">Uint256</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>profile</strong></td>
<td valign="top"><a href="#profile">Profile</a></td>
<td></td>
</tr>
</tbody>
</table>

### FileUploadOutput

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>bucket</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>accessKey</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>secretKey</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>sessionToken</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### FollowersOutput

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>items</strong></td>
<td valign="top">[<a href="#wallet">Wallet</a>!]!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pageInfo</strong></td>
<td valign="top"><a href="#pageinfo">PageInfo</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>totalItems</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
</tbody>
</table>

### GetMarketAsk

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>items</strong></td>
<td valign="top">[<a href="#marketask">MarketAsk</a>!]</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pageInfo</strong></td>
<td valign="top"><a href="#pageinfo">PageInfo</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>totalItems</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
</tbody>
</table>

### GetMarketBid

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>items</strong></td>
<td valign="top">[<a href="#marketbid">MarketBid</a>!]</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pageInfo</strong></td>
<td valign="top"><a href="#pageinfo">PageInfo</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>totalItems</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
</tbody>
</table>

### GetMarketSwap

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>items</strong></td>
<td valign="top">[<a href="#marketswap">MarketSwap</a>!]</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pageInfo</strong></td>
<td valign="top"><a href="#pageinfo">PageInfo</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>totalItems</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
</tbody>
</table>

### MarketAsk

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>structHash</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>signature</strong></td>
<td valign="top"><a href="#signature">Signature</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>makerAddress</strong></td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>makeAsset</strong></td>
<td valign="top">[<a href="#marketplaceasset">MarketplaceAsset</a>!]</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>takerAddress</strong></td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>takeAsset</strong></td>
<td valign="top">[<a href="#marketplaceasset">MarketplaceAsset</a>!]</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>start</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>end</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>salt</strong></td>
<td valign="top"><a href="#int">Int</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>offerAcceptedAt</strong></td>
<td valign="top"><a href="#datetime">DateTime</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>chainId</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### MarketBid

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>structHash</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>signature</strong></td>
<td valign="top"><a href="#signature">Signature</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>marketAskId</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>makerAddress</strong></td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>makeAsset</strong></td>
<td valign="top">[<a href="#marketplaceasset">MarketplaceAsset</a>!]</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>takerAddress</strong></td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>takeAsset</strong></td>
<td valign="top">[<a href="#marketplaceasset">MarketplaceAsset</a>!]</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>message</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>start</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>end</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>salt</strong></td>
<td valign="top"><a href="#int">Int</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>offerAcceptedAt</strong></td>
<td valign="top"><a href="#datetime">DateTime</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>acceptedAt</strong></td>
<td valign="top"><a href="#datetime">DateTime</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>rejectedAt</strong></td>
<td valign="top"><a href="#datetime">DateTime</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>rejectedReason</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>chainId</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### MarketSwap

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>askId</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>bidId</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>txHash</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>blockNumber</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>private</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
</tbody>
</table>

### MarketplaceAsset

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>standard</strong></td>
<td valign="top"><a href="#assettype">AssetType</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>bytes</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>value</strong></td>
<td valign="top"><a href="#uint256">Uint256</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>minimumBid</strong></td>
<td valign="top"><a href="#uint256">Uint256</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### NFT

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>id</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>contract</strong></td>
<td valign="top"><a href="#address">Address</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>tokenId</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>isOwnedByMe</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>metadata</strong></td>
<td valign="top"><a href="#nftmetadata">NFTMetadata</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>price</strong></td>
<td valign="top"><a href="#uint256">Uint256</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>type</strong></td>
<td valign="top"><a href="#nfttype">NFTType</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>wallet</strong></td>
<td valign="top"><a href="#wallet">Wallet</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>createdAt</strong></td>
<td valign="top"><a href="#datetime">DateTime</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### NFTMetadata

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>name</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>description</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>imageURL</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>traits</strong></td>
<td valign="top">[<a href="#nfttrait">NFTTrait</a>!]!</td>
<td></td>
</tr>
</tbody>
</table>

### NFTTrait

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>type</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>value</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### NFTsOutput

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>items</strong></td>
<td valign="top">[<a href="#nft">NFT</a>!]!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pageInfo</strong></td>
<td valign="top"><a href="#pageinfo">PageInfo</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>totalItems</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
</tbody>
</table>

### PageInfo

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>firstCursor</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>lastCursor</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
</tbody>
</table>

### Profile

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>id</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>bannerURL</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>createdAt</strong></td>
<td valign="top"><a href="#datetime">DateTime</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>description</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>followersCount</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>isFollowedByMe</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>isOwnedByMe</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>owner</strong></td>
<td valign="top"><a href="#wallet">Wallet</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>photoURL</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>status</strong></td>
<td valign="top"><a href="#profilestatus">ProfileStatus</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>url</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>winningBid</strong></td>
<td valign="top"><a href="#bid">Bid</a></td>
<td></td>
</tr>
</tbody>
</table>

### ProfilesOutput

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>items</strong></td>
<td valign="top">[<a href="#profile">Profile</a>!]!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pageInfo</strong></td>
<td valign="top"><a href="#pageinfo">PageInfo</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>totalItems</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
</tbody>
</table>

### RefreshMyNFTsOutput

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>status</strong></td>
<td valign="top"><a href="#boolean">Boolean</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>message</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
</tbody>
</table>

### Signature

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>v</strong></td>
<td valign="top"><a href="#int">Int</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>r</strong></td>
<td valign="top"><a href="#bytes">Bytes</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>s</strong></td>
<td valign="top"><a href="#bytes">Bytes</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### User

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>id</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>avatarURL</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>email</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>username</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>isEmailConfirmed</strong></td>
<td valign="top"><a href="#boolean">Boolean</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>myAddresses</strong></td>
<td valign="top">[<a href="#wallet">Wallet</a>!]</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>myApprovals</strong></td>
<td valign="top">[<a href="#approval">Approval</a>!]</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>preferences</strong></td>
<td valign="top"><a href="#userpreferences">UserPreferences</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>referredBy</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>referralId</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### UserPreferences

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>bidActivityNotifications</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>priceChangeNotifications</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>outbidNotifications</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>purchaseSuccessNotifications</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>promotionalNotifications</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
</tbody>
</table>

### Wallet

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>id</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>address</strong></td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>chainId</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>chainName</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>network</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>user</strong></td>
<td valign="top"><a href="#user">User</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>createdAt</strong></td>
<td valign="top"><a href="#datetime">DateTime</a>!</td>
<td></td>
</tr>
</tbody>
</table>

## Inputs

### ApprovalInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>amount</strong></td>
<td valign="top"><a href="#uint256">Uint256</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>currency</strong></td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>deadline</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>nonce</strong></td>
<td valign="top"><a href="#int">Int</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>signature</strong></td>
<td valign="top"><a href="#signatureinput">SignatureInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>spender</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>txHash</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>wallet</strong></td>
<td valign="top"><a href="#walletinput">WalletInput</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### AsksInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>makerAddress</strong></td>
<td valign="top"><a href="#address">Address</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pageInput</strong></td>
<td valign="top"><a href="#pageinput">PageInput</a></td>
<td></td>
</tr>
</tbody>
</table>

### AssetTypeInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>assetClass</strong></td>
<td valign="top"><a href="#assetclass">AssetClass</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>bytes</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>contractAddress</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>tokenId</strong></td>
<td valign="top"><a href="#uint256">Uint256</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>allowAll</strong></td>
<td valign="top"><a href="#boolean">Boolean</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### BidInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>nftType</strong></td>
<td valign="top"><a href="#nfttype">NFTType</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>wallet</strong></td>
<td valign="top"><a href="#walletinput">WalletInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>price</strong></td>
<td valign="top"><a href="#uint256">Uint256</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>profileURL</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>signature</strong></td>
<td valign="top"><a href="#signatureinput">SignatureInput</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### BidsInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>pageInput</strong></td>
<td valign="top"><a href="#pageinput">PageInput</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>profileId</strong></td>
<td valign="top"><a href="#id">ID</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>wallet</strong></td>
<td valign="top"><a href="#walletinput">WalletInput</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>nftType</strong></td>
<td valign="top"><a href="#nfttype">NFTType</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>makerAddress</strong></td>
<td valign="top"><a href="#address">Address</a></td>
<td></td>
</tr>
</tbody>
</table>

### CollectionInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>contract</strong></td>
<td valign="top"><a href="#address">Address</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>network</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
</tbody>
</table>

### CollectionNFTsInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>collectionAddress</strong></td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pageInput</strong></td>
<td valign="top"><a href="#pageinput">PageInput</a></td>
<td></td>
</tr>
</tbody>
</table>

### CreateAskInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>structHash</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>signature</strong></td>
<td valign="top"><a href="#signatureinput">SignatureInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>makerAddress</strong></td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>makeAsset</strong></td>
<td valign="top">[<a href="#marketplaceassetinput">MarketplaceAssetInput</a>!]</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>takerAddress</strong></td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>takeAsset</strong></td>
<td valign="top">[<a href="#marketplaceassetinput">MarketplaceAssetInput</a>!]</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>start</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>end</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>salt</strong></td>
<td valign="top"><a href="#int">Int</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>chainId</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### CreateBidInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>structHash</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>signature</strong></td>
<td valign="top"><a href="#signatureinput">SignatureInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>marketAskId</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>makerAddress</strong></td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>makeAsset</strong></td>
<td valign="top">[<a href="#marketplaceassetinput">MarketplaceAssetInput</a>!]</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>takerAddress</strong></td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>takeAsset</strong></td>
<td valign="top">[<a href="#marketplaceassetinput">MarketplaceAssetInput</a>!]</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>message</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>start</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>end</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>salt</strong></td>
<td valign="top"><a href="#int">Int</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>chainId</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### CreateCurationInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>items</strong></td>
<td valign="top">[<a href="#curationiteminput">CurationItemInput</a>!]!</td>
<td></td>
</tr>
</tbody>
</table>

### CurationInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>curationId</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pageInput</strong></td>
<td valign="top"><a href="#pageinput">PageInput</a></td>
<td></td>
</tr>
</tbody>
</table>

### CurationItemInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>size</strong></td>
<td valign="top"><a href="#nftsize">NFTSize</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>id</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### CurationsInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>pageInput</strong></td>
<td valign="top"><a href="#pageinput">PageInput</a></td>
<td></td>
</tr>
</tbody>
</table>

### EndAuctionInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>profileId</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>walletId</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### FollowersInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>profileId</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pageInput</strong></td>
<td valign="top"><a href="#pageinput">PageInput</a></td>
<td></td>
</tr>
</tbody>
</table>

### MarketplaceAssetInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>standard</strong></td>
<td valign="top"><a href="#assettypeinput">AssetTypeInput</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>bytes</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>value</strong></td>
<td valign="top"><a href="#uint256">Uint256</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>minimumBid</strong></td>
<td valign="top"><a href="#uint256">Uint256</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### MintGKProfileInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>startIndex</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>count</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
</tbody>
</table>

### NFTsInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>pageInput</strong></td>
<td valign="top"><a href="#pageinput">PageInput</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>types</strong></td>
<td valign="top">[<a href="#nfttype">NFTType</a>!]</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>profileId</strong></td>
<td valign="top"><a href="#id">ID</a></td>
<td></td>
</tr>
</tbody>
</table>

### PageInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>first</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>last</strong></td>
<td valign="top"><a href="#int">Int</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>afterCursor</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>beforeCursor</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
</tbody>
</table>

### ProfileClaimedInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>profileId</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>walletId</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>txHash</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### ProfilePreferenceInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>urls</strong></td>
<td valign="top">[<a href="#string">String</a>!]!</td>
<td></td>
</tr>
</tbody>
</table>

### ProfilesInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>pageInput</strong></td>
<td valign="top"><a href="#pageinput">PageInput</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>statuses</strong></td>
<td valign="top">[<a href="#profilestatus">ProfileStatus</a>]</td>
<td></td>
</tr>
</tbody>
</table>

### RemoveCurationInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>profileId</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### SetCurationInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>profileId</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>curationId</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### SignUpInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>avatarURL</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>email</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>username</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>referredBy</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>wallet</strong></td>
<td valign="top"><a href="#walletinput">WalletInput</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### SignatureInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>v</strong></td>
<td valign="top"><a href="#int">Int</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>r</strong></td>
<td valign="top"><a href="#bytes">Bytes</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>s</strong></td>
<td valign="top"><a href="#bytes">Bytes</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### SwapsInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>askId</strong></td>
<td valign="top"><a href="#address">Address</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>bidId</strong></td>
<td valign="top"><a href="#address">Address</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pageInput</strong></td>
<td valign="top"><a href="#pageinput">PageInput</a></td>
<td></td>
</tr>
</tbody>
</table>

### TopBidsInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>pageInput</strong></td>
<td valign="top"><a href="#pageinput">PageInput</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>profileId</strong></td>
<td valign="top"><a href="#id">ID</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>status</strong></td>
<td valign="top"><a href="#bidstatus">BidStatus</a></td>
<td></td>
</tr>
</tbody>
</table>

### UpdateCurationInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>id</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>items</strong></td>
<td valign="top">[<a href="#curationiteminput">CurationItemInput</a>!]!</td>
<td></td>
</tr>
</tbody>
</table>

### UpdateEmailInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>email</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### UpdateProfileInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>id</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>bannerURL</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>description</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>photoURL</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
</tbody>
</table>

### UpdateUserInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>email</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>avatarURL</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>preferences</strong></td>
<td valign="top"><a href="#userpreferencesinput">UserPreferencesInput</a></td>
<td></td>
</tr>
</tbody>
</table>

### UserPreferencesInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>bidActivityNotifications</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>priceChangeNotifications</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>outbidNotifications</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>purchaseSuccessNotifications</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>promotionalNotifications</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td></td>
</tr>
</tbody>
</table>

### WalletInput

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>address</strong></td>
<td valign="top"><a href="#address">Address</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>chainId</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>network</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
</tbody>
</table>

## Enums

### AssetClass

<table>
<thead>
<th align="left">Value</th>
<th align="left">Description</th>
</thead>
<tbody>
<tr>
<td valign="top"><strong>ETH</strong></td>
<td></td>
</tr>
<tr>
<td valign="top"><strong>ERC20</strong></td>
<td></td>
</tr>
<tr>
<td valign="top"><strong>ERC721</strong></td>
<td></td>
</tr>
<tr>
<td valign="top"><strong>ERC1155</strong></td>
<td></td>
</tr>
</tbody>
</table>

### BidStatus

<table>
<thead>
<th align="left">Value</th>
<th align="left">Description</th>
</thead>
<tbody>
<tr>
<td valign="top"><strong>Executed</strong></td>
<td></td>
</tr>
<tr>
<td valign="top"><strong>Submitted</strong></td>
<td></td>
</tr>
</tbody>
</table>

### NFTSize

<table>
<thead>
<th align="left">Value</th>
<th align="left">Description</th>
</thead>
<tbody>
<tr>
<td valign="top"><strong>Small</strong></td>
<td></td>
</tr>
<tr>
<td valign="top"><strong>Medium</strong></td>
<td></td>
</tr>
<tr>
<td valign="top"><strong>Large</strong></td>
<td></td>
</tr>
</tbody>
</table>

### NFTType

<table>
<thead>
<th align="left">Value</th>
<th align="left">Description</th>
</thead>
<tbody>
<tr>
<td valign="top"><strong>ERC721</strong></td>
<td></td>
</tr>
<tr>
<td valign="top"><strong>ERC1155</strong></td>
<td></td>
</tr>
<tr>
<td valign="top"><strong>Profile</strong></td>
<td></td>
</tr>
<tr>
<td valign="top"><strong>GenesisKey</strong></td>
<td></td>
</tr>
<tr>
<td valign="top"><strong>GenesisKeyProfile</strong></td>
<td></td>
</tr>
</tbody>
</table>

### ProfileStatus

<table>
<thead>
<th align="left">Value</th>
<th align="left">Description</th>
</thead>
<tbody>
<tr>
<td valign="top"><strong>Available</strong></td>
<td></td>
</tr>
<tr>
<td valign="top"><strong>Pending</strong></td>
<td></td>
</tr>
<tr>
<td valign="top"><strong>Owned</strong></td>
<td></td>
</tr>
</tbody>
</table>

## Scalars

### Address

Equivalent to solidity's address type

### Boolean

The `Boolean` scalar type represents `true` or `false`.

### Bytes

Equivalent to solidity's bytes type

### Date

A date string, such as 2007-12-03, compliant with the `full-date` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar.

### DateTime

A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar.

### ID

The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID.

### Int

The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.

### String

The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.

### Uint256

Equivalent to solidity's uint256 type

