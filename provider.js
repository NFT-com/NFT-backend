const { ethers } = require("ethers");
const config = require("./config");

const etherscanArray = [
  config.etherscanAPI,
  config.etherscanAPI2,
  config.etherscanAPI3,
  config.etherscanAPI4,
  config.etherscanAPI5,
  config.etherscanAPI6,
  config.etherscanAPI7,
  config.etherscanAPI8,
  config.etherscanAPI9,
  config.etherscanAPI10,
  config.etherscanAPI11,
  config.etherscanAPI12,
  config.etherscanAPI13,
  config.etherscanAPI14,
  config.etherscanAPI15,
  config.etherscanAPI16,
  config.etherscanAPI17,
  config.etherscanAPI18,
  config.etherscanAPI19,
  config.etherscanAPI20,
  config.etherscanAPI21,
  config.etherscanAPI22,
  config.etherscanAPI23,
  config.etherscanAPI24,
];

const provider = (production = true, useApi3 = false) => {
  return production
    ? new ethers.providers.EtherscanProvider(
        "homestead",
        useApi3 ? config.etherscanAPI3 : getRandomAPI()
      )
    : new ethers.providers.EtherscanProvider(
        "rinkeby",
        useApi3 ? config.etherscanAPI3 : getRandomAPI()
      );
};

const getRandomAPI = () => {
  const length = etherscanArray.length;

  const maxIndex = length - 1;
  const minIndex = 0;

  const randomIndex = (Math.random() * (maxIndex - minIndex + 1)) << 0;
  return etherscanArray[randomIndex];
};

module.exports = {
  provider,
  getRandomAPI
};