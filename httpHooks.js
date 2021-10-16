const { request } = require("graphql-request");
const config = require("./config");
const { ethers } = require("ethers");
const { provider } = require("./provider");

const isSandbox = (chainId) => {
  switch (Number(chainId)) {
    case 1:
      return false;
    default:
      return true;
  }
};

const isProduction = (chainId) => {
  return !isSandbox(chainId);
};

const getContract = (token, chainId, providerOverrideBool = false, providerOverride) => {
  const p = isProduction(chainId);
  const contractNft = new ethers.Contract(
    getAddress("nft", chainId),
    getABI("nft", chainId),
    providerOverrideBool ? providerOverride : provider(p)
  );

  const contractProfileAuction = new ethers.Contract(
    getAddress("profileAuction", chainId),
    getABI("profileAuction", chainId),
    providerOverrideBool ? providerOverride : provider(p)
  );

  const bondingCurve = new ethers.Contract(
    getAddress("bondingCurve", chainId),
    getABI("bondingCurve", chainId),
    providerOverrideBool ? providerOverride : provider(p)
  )

  const nftProfileContract = new ethers.Contract(
    getAddress("nftProfile", chainId),
    getABI("nftProfile", chainId),
    providerOverrideBool ? providerOverride : provider(p)
  );

  const contractUsdc = new ethers.Contract(
    getAddress("usdc", chainId),
    getABI("usdc", chainId),
    providerOverrideBool ? providerOverride : provider(p)
  );

  const contractDai = new ethers.Contract(
    getAddress("dai", chainId),
    getABI("dai", chainId),
    providerOverrideBool ? providerOverride : provider(p)
  );

  const contractWeth = new ethers.Contract(
    getAddress("weth", chainId),
    getABI("weth", chainId),
    providerOverrideBool ? providerOverride : provider(p)
  );

  switch (token) {
    case "nft":
      return contractNft
    case "profileAuction":
      return contractProfileAuction;
    case "bondingCurve":
      return bondingCurve;
    case "nftProfile":
      return nftProfileContract;
    case "usdc":
      return contractUsdc;
    case "dai":
      return contractDai;
    case "weth":
      return contractWeth;
    default:
      return contractNft;
  }
}

const getAddress = (token, chainId) => {
  switch (token) {
    case "nft":
      return isSandbox(chainId)
        ? config.nftToken.rinkeby.address
        : config.nftToken.mainnet.address;
    case "bondingCurve":
    return isSandbox(chainId)
      ? config.bondingCurve.rinkeby.address
      : config.bondingCurve.mainnet.address;
    case "profileAuction":
      return isSandbox(chainId)
        ? config.profileAuction.rinkeby.address
        : config.profileAuction.mainnet.address;
    case "nftProfile":
        return isSandbox(chainId)
          ? config.nftProfile.rinkeby.address
          : config.nftProfile.mainnet.address;
    case "usdc":
      return isSandbox(chainId)
        ? config.usdc.rinkeby.address
        : config.usdc.mainnet.address;
    case "dai":
      return isSandbox(chainId)
        ? config.dai.rinkeby.address
        : config.dai.mainnet.address;
    case "weth":
      return isSandbox(chainId)
        ? config.weth.rinkeby.address
        : config.weth.mainnet.address;
    default:
      return "";
  }
};

const getABI = (token, chainId) => {
  switch (token) {
    case "nft":
      return isSandbox(chainId)
        ? config.nftToken.rinkeby.ABI
        : config.nftToken.mainnet.ABI;
    case "bondingCurve":
      return isSandbox(chainId)
        ? config.bondingCurve.rinkeby.ABI
        : config.bondingCurve.mainnet.ABI;
    case "profileAuction":
      return isSandbox(chainId)
        ? config.profileAuction.rinkeby.ABI
        : config.profileAuction.mainnet.ABI;
        case "nftProfile":
        return isSandbox(chainId)
          ? config.nftProfile.rinkeby.ABI
          : config.nftProfile.mainnet.ABI;
    case "usdc":
      return isSandbox(chainId)
        ? config.usdc.rinkeby.ABI
        : config.usdc.mainnet.ABI;
    case "dai":
      return isSandbox(chainId)
        ? config.dai.rinkeby.ABI
        : config.dai.mainnet.ABI;
    case "weth":
      return isSandbox(chainId)
        ? config.weth.rinkeby.ABI
        : config.weth.mainnet.ABI;
    default:
      return "";
  }
};

module.exports = {
  isProduction,
  getContract,
  getAddress,
  getABI
}