/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import { Provider } from "@ethersproject/providers";
import type {
  ValidationLogic,
  ValidationLogicInterface,
} from "../ValidationLogic";

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "previousAdmin",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "newAdmin",
        type: "address",
      },
    ],
    name: "AdminChanged",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "beacon",
        type: "address",
      },
    ],
    name: "BeaconUpgraded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint8",
        name: "version",
        type: "uint8",
      },
    ],
    name: "Initialized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "implementation",
        type: "address",
      },
    ],
    name: "Upgraded",
    type: "event",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "maker",
            type: "address",
          },
          {
            components: [
              {
                components: [
                  {
                    internalType: "bytes4",
                    name: "assetClass",
                    type: "bytes4",
                  },
                  {
                    internalType: "bytes",
                    name: "data",
                    type: "bytes",
                  },
                ],
                internalType: "struct LibAsset.AssetType",
                name: "assetType",
                type: "tuple",
              },
              {
                internalType: "bytes",
                name: "data",
                type: "bytes",
              },
            ],
            internalType: "struct LibAsset.Asset[]",
            name: "makeAssets",
            type: "tuple[]",
          },
          {
            internalType: "address",
            name: "taker",
            type: "address",
          },
          {
            components: [
              {
                components: [
                  {
                    internalType: "bytes4",
                    name: "assetClass",
                    type: "bytes4",
                  },
                  {
                    internalType: "bytes",
                    name: "data",
                    type: "bytes",
                  },
                ],
                internalType: "struct LibAsset.AssetType",
                name: "assetType",
                type: "tuple",
              },
              {
                internalType: "bytes",
                name: "data",
                type: "bytes",
              },
            ],
            internalType: "struct LibAsset.Asset[]",
            name: "takeAssets",
            type: "tuple[]",
          },
          {
            internalType: "uint256",
            name: "salt",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "start",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "end",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "nonce",
            type: "uint256",
          },
          {
            internalType: "enum LibSignature.AuctionType",
            name: "auctionType",
            type: "uint8",
          },
        ],
        internalType: "struct LibSignature.Order",
        name: "sellOrder",
        type: "tuple",
      },
    ],
    name: "getDecreasingPrice",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "proxiableUUID",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newImplementation",
        type: "address",
      },
    ],
    name: "upgradeTo",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newImplementation",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "upgradeToAndCall",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "maker",
            type: "address",
          },
          {
            components: [
              {
                components: [
                  {
                    internalType: "bytes4",
                    name: "assetClass",
                    type: "bytes4",
                  },
                  {
                    internalType: "bytes",
                    name: "data",
                    type: "bytes",
                  },
                ],
                internalType: "struct LibAsset.AssetType",
                name: "assetType",
                type: "tuple",
              },
              {
                internalType: "bytes",
                name: "data",
                type: "bytes",
              },
            ],
            internalType: "struct LibAsset.Asset[]",
            name: "makeAssets",
            type: "tuple[]",
          },
          {
            internalType: "address",
            name: "taker",
            type: "address",
          },
          {
            components: [
              {
                components: [
                  {
                    internalType: "bytes4",
                    name: "assetClass",
                    type: "bytes4",
                  },
                  {
                    internalType: "bytes",
                    name: "data",
                    type: "bytes",
                  },
                ],
                internalType: "struct LibAsset.AssetType",
                name: "assetType",
                type: "tuple",
              },
              {
                internalType: "bytes",
                name: "data",
                type: "bytes",
              },
            ],
            internalType: "struct LibAsset.Asset[]",
            name: "takeAssets",
            type: "tuple[]",
          },
          {
            internalType: "uint256",
            name: "salt",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "start",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "end",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "nonce",
            type: "uint256",
          },
          {
            internalType: "enum LibSignature.AuctionType",
            name: "auctionType",
            type: "uint8",
          },
        ],
        internalType: "struct LibSignature.Order",
        name: "sellOrder",
        type: "tuple",
      },
      {
        internalType: "address",
        name: "buyer",
        type: "address",
      },
    ],
    name: "validateBuyNow",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "maker",
            type: "address",
          },
          {
            components: [
              {
                components: [
                  {
                    internalType: "bytes4",
                    name: "assetClass",
                    type: "bytes4",
                  },
                  {
                    internalType: "bytes",
                    name: "data",
                    type: "bytes",
                  },
                ],
                internalType: "struct LibAsset.AssetType",
                name: "assetType",
                type: "tuple",
              },
              {
                internalType: "bytes",
                name: "data",
                type: "bytes",
              },
            ],
            internalType: "struct LibAsset.Asset[]",
            name: "makeAssets",
            type: "tuple[]",
          },
          {
            internalType: "address",
            name: "taker",
            type: "address",
          },
          {
            components: [
              {
                components: [
                  {
                    internalType: "bytes4",
                    name: "assetClass",
                    type: "bytes4",
                  },
                  {
                    internalType: "bytes",
                    name: "data",
                    type: "bytes",
                  },
                ],
                internalType: "struct LibAsset.AssetType",
                name: "assetType",
                type: "tuple",
              },
              {
                internalType: "bytes",
                name: "data",
                type: "bytes",
              },
            ],
            internalType: "struct LibAsset.Asset[]",
            name: "takeAssets",
            type: "tuple[]",
          },
          {
            internalType: "uint256",
            name: "salt",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "start",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "end",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "nonce",
            type: "uint256",
          },
          {
            internalType: "enum LibSignature.AuctionType",
            name: "auctionType",
            type: "uint8",
          },
        ],
        internalType: "struct LibSignature.Order",
        name: "sellOrder",
        type: "tuple",
      },
      {
        components: [
          {
            internalType: "address",
            name: "maker",
            type: "address",
          },
          {
            components: [
              {
                components: [
                  {
                    internalType: "bytes4",
                    name: "assetClass",
                    type: "bytes4",
                  },
                  {
                    internalType: "bytes",
                    name: "data",
                    type: "bytes",
                  },
                ],
                internalType: "struct LibAsset.AssetType",
                name: "assetType",
                type: "tuple",
              },
              {
                internalType: "bytes",
                name: "data",
                type: "bytes",
              },
            ],
            internalType: "struct LibAsset.Asset[]",
            name: "makeAssets",
            type: "tuple[]",
          },
          {
            internalType: "address",
            name: "taker",
            type: "address",
          },
          {
            components: [
              {
                components: [
                  {
                    internalType: "bytes4",
                    name: "assetClass",
                    type: "bytes4",
                  },
                  {
                    internalType: "bytes",
                    name: "data",
                    type: "bytes",
                  },
                ],
                internalType: "struct LibAsset.AssetType",
                name: "assetType",
                type: "tuple",
              },
              {
                internalType: "bytes",
                name: "data",
                type: "bytes",
              },
            ],
            internalType: "struct LibAsset.Asset[]",
            name: "takeAssets",
            type: "tuple[]",
          },
          {
            internalType: "uint256",
            name: "salt",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "start",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "end",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "nonce",
            type: "uint256",
          },
          {
            internalType: "enum LibSignature.AuctionType",
            name: "auctionType",
            type: "uint8",
          },
        ],
        internalType: "struct LibSignature.Order",
        name: "buyOrder",
        type: "tuple",
      },
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        internalType: "bool",
        name: "viewOnly",
        type: "bool",
      },
    ],
    name: "validateMatch_",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
];

export class ValidationLogic__factory {
  static readonly abi = _abi;
  static createInterface(): ValidationLogicInterface {
    return new utils.Interface(_abi) as ValidationLogicInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): ValidationLogic {
    return new Contract(address, _abi, signerOrProvider) as ValidationLogic;
  }
}
