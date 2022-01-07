import { ethers } from 'ethers'
import Web3 from 'web3'

const etherscanKeys = [
  'BTRSUQC5NP494HS3IRYC1DQVRI89TS46MD',
  '25E9BG3FRGXFBFK6VRNEQ37W2A8784B475',
  'B4S1U64KIS797JQS596IM8XXZIXXCEF423',
  'H62N2X9BEFVZEC87A6N71A95PH1BY1ZTXB',
  '21ZYG37YB5U8UXBVFFDH9UTKDRS8H25MCT',
  '17WD2JR7T9P8KC7GJJ1FQ4JX17W5MRD3ZI',
  'V23YA18YZA6GAY1R324JMSG6X353B8X4GS',
  'MUW248RRZ8UQI7XTJGA5JYYJRRKBSQI4P5',
  '7BRHBUUHU5ZXRZ6HADYRTGZSBIIQCP58PY',
  'M3B3JU452TJ2M5DGQC1P664IR1ADTCPBDN',
  'BFYDP336HCFX3H5YGGQYBYJNBC1NTNMPI2',
  'A481IQ4Y6WYF961CQ2Y32BJJP7QG6I89V7',
  '1RY1ICMGQRXYKMJ7E7T75P7DCBN6A7IP2D',
  '2GRUT78X9V3M91ZSMS45C251AS32JTYSQW',
  'E1WKTW9QC6V3SGM8F6QERBCX4KF75XJBBG',
  'HW3Q42R4J4WY5HHINNDAI515V59XT5QCU5',
  'QC8VP7UHXTFJSGSUMJBQ1MX7RJT5UFAGVV',
  'ZWXR8F9I8G92WF42NAX2RTMHHE9ZDXHGYZ',
  'PFGWRD38DM8BB6TYHZ45ZVNNPI84BM13WT',
  'XHSKP3E7E312CY67D7KSJDB8ZMPGTKKGUM',
  'NBD9XB7AEMGKGV2HHXR22915ABNRHU21SU',
  '1DRNAZ39TR2VSYXS9BCYMS48GIIMMC4WXP',
  'RR4BJU4GKPK53DDYN4H8KY3U2BG3BWKYMQ',
  'S2Y8649IS2BMFWVW51NETTNAA9C16Q4MHD',
]

const getRandomAPI = (): string => {
  const length = etherscanKeys.length
  
  const maxIndex = length - 1
  const minIndex = 0
  
  const randomIndex = (Math.random() * (maxIndex - minIndex + 1)) << 0
  return etherscanKeys[randomIndex]
}

export const web3 = (chainId: string | number = 'mainnet'): any => {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return new Web3(new Web3.providers.HttpProvider('https://rinkeby.infura.io/v3/ff54943ff46d4447a007337a563ba4f4'))
  case '0':
  case 0:
  case 'mainnet':
  default:
    return new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/ff54943ff46d4447a007337a563ba4f4'))
  }
}

export const provider = (chainId = 1): ethers.providers.BaseProvider => {
  return ethers.getDefaultProvider(chainId, {
    etherscan: getRandomAPI(),
    infura: process.env.REACT_APP_INFURA_API_KEY,
    alchemy: process.env.REACT_APP_ALCHEMY_API_KEY,
  })
}