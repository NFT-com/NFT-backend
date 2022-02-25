# Resolver Readme

marketAsk and marketBid entities interface strongly with our nft marketplace smart contracts.

the smart contracts utilize `eth_signTypedData_v4`, which is an implementation of EIP-712, which allows users to sign data using their private key.

to learn more about this, [click here](https://docs.metamask.io/guide/signing-data.html).

```
struct Order {
    address maker;                // user making a order (buy or sell)
    LibAsset.Asset[] makeAssets;  // asset(s) being sold or used to buy
    address taker;                // optional param => who is allowed to buy or sell, ZERO_ADDRESS if public sale
    LibAsset.Asset[] takeAssets;  // desired counterAsset(s), can be empty to allow any bids
    uint256 salt;                 // unique salt to eliminate collisons
    uint256 start;                // optional: set = 0 to disregard. start Unix timestamp of when order is valid
    uint256 end;                  // optional: set = 0 to disregard. end Unix timestamp of when order is invalid
    uint256 nonce;                // nonce for all orders
}
```

```
struct Asset {
    AssetType assetType;
    bytes data;             (uint256, uint256) = value, minimumBid
                            //      SELL ORDER:
                            //          MAKE: (the amount for sale, 0)
                            //          TAKE: (buy now price, min bid value)
                            //      BUY  ORDER:
                            //          MAKE: (amount offered must >= min bid value, 0)
                            //          TAKE: (must match sell order make, 0)
}
```

```
struct AssetType {
    bytes4 assetClass;      // asset class (erc20, 721, etc)
    bytes data;             // (address, uint256, bool) = (contract address, tokenId - only NFTs, allow all from collection - only NFTs)
                            // if allow all = true, ignore tokenId
}
```

Here are the three structs that compose an order in our smart contract. At the top, we have `Order`, which takes in some fields.

### Struct 2: Asset

`makeAssets` and `takeAssets` are `Asset` arrays, which bring us to the second struct: `Asset`.

`Asset` contains our third struct, `AssetType`, and `bytes data`.

`Asset` data is just the hashed abi.encodeing of two uint256. 
1. uint256 value
2. uint256 minimumBid

To encode these value to derive `bytes data`, in javascript: 
```
import { defaultAbiCoder } from "ethers/lib/utils";

export const encode = (types: string[], values: any[]): string => {
  return defaultAbiCoder.encode(types, values);
};

encode(['uint256, uint256'], [value, minimumBid])
```

To decode, use `defaultAbiCoder.decode()`

**Important:** `bytes data` for `Asset` is different for sell orders and buy orders, in addition to make or take assets. Refer to the table 1 above for more details.

### Struct 3: AssetType

Moving to `AssetType` struct, you see there are two fields.
1. `bytes4 assetClass`
2. `bytes data`

`bytes4 assetClass` is simply the first 10 digits of the encoded hash of asset used.

Here are the current assetClasses and their respective bytes4 code:
```
import { keccak256, toUtf8Bytes } from "ethers/lib/utils";
* ETH => keccak256(toUtf8Bytes(text)).substring(0, 10)
* ERC20 => keccak256(toUtf8Bytes(text)).substring(0, 10)
* ERC721 => keccak256(toUtf8Bytes(text)).substring(0, 10)
* ERC1155 => keccak256(toUtf8Bytes(text)).substring(0, 10)
```

If you print out the results for each, you'll get the value used for the `bytes4 assetClass` field.

`bytes data` for `AssetType` is an encoding of the following:
ETH
* encode(['address'], [0x0000000000000000000000000000000000000000])
* *we use the NULL_ADDRESS since ETH is not a contract address*
ERC20
* encode(['address'], [insert_erc20_contract_address])
* *be sure to plug int the address of the smart contract for the token
ERC721
* encode(['address', 'uint256', 'bool'], [insert_erc721_contract_address, tokenId, allowAll])
* *the tokenId is the requested tokenId a user desires, and allowAll allows a user to allow all tokenIds from a certain collection, thereby bypassing the tokenId parameter*
ERC1155
* encode(['address', 'uint256', 'bool'], [insert_erc1155_contract_address, tokenId, allowAll])
* *pretty similar to ERC721*