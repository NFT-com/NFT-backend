import axios from 'axios'

import { fetchData } from './nftport-client'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
  cache: {
    get: (key: string) => {
      if (key.startsWith('ERC20_SYMBOL_')) {
        return Promise.resolve('WETH')
      }
      return Promise.resolve(undefined)
    },
    set: jest.fn(),
  },
}))

jest.mock('./nftport-interceptor', () => ({
  getNFTPortInterceptor: () => mockedAxios,
}))

describe('nftport-client', () => {
  describe('fetchData', () => {
    it('should exist', () => {
      expect(typeof fetchData).toBe('function')
    })

    it('should fetch NFT details', async () => {
      const nftDetails = {
        response: 'OK',
        nft: {
          chain: 'ethereum',
          contract_address: '0x98ca78e89dd1abe48a53dee5799f24cc1a462f2d',
          token_id: '625',
          metadata_url: 'https://prod-api.nft.com/uri/pepe',
          metadata: {
            description: 'NFT.com profile for pepe',
            header: 'https://cdn.nft.com/profile-banner-default-logo-key.png',
            image: 'https://cdn.nft.com/profiles/1651637367539-pepe.svg',
            name: 'pepe',
          },
          file_information: null,
          file_url: 'https://cdn.nft.com/profiles/1651637367539-pepe.svg',
          animation_url: null,
          cached_file_url:
            'https://storage.googleapis.com/sentinel-nft/raw-assets/d8bfe199789cb0cf1739900f7d014e958c786d67ba4cc9ef581d44a481d6e465.svg+xml',
          cached_animation_url: null,
          mint_date: '2022-04-29T23:10:10',
          updated_date: '2022-05-11T16:30:21.412678',
        },
        owner: '0x17cabb6dc7de7e3e562b0993086915c2c0209860',
        contract: {
          name: 'NFT.com Profile',
          symbol: 'NFTPROFILE',
          type: 'ERC721',
          metadata: {
            description: 'NFT Profiles for NFT.com',
            thumbnail_url:
              'https://lh3.googleusercontent.com/U5pRG_3Sw8I9vbDHfGQyi5_6INrgxD2hsx3nbMnwr84n8BdzFGYNnZrmvYf9z773t8b8wqlpNAI-N7wTexc3uOiVAcj0_IsjcBCTdw=s120',
            cached_thumbnail_url:
              'https://storage.googleapis.com/sentinel-nft/raw-assets/68ebcd748427910eb0e23783a6deb15acb0ba60987cd94a7eef28b7aa72028fc.png',
            banner_url:
              'https://lh3.googleusercontent.com/OvplKu8P0_wcPSCMxio11LpK9uB5oodFOGsmPtF0ND2Tjj3-dfkVFKIIfM6hI3In7_zoE0cVBfcQmkK0FhnXEj-y5-zK8d8ZF9aKgw=s2500',
            cached_banner_url:
              'https://storage.googleapis.com/sentinel-nft/raw-assets/a704d6d173cee6719fd7987ab01b8f0c47910df2d1621c292df55cc927af98ce.png',
          },
        },
      }
      mockedAxios.get.mockResolvedValueOnce(Promise.resolve({ data: nftDetails }))

      const response = await fetchData('nfts', ['0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D', '625'], {
        queryParams: { refresh_metadata: false },
      })

      expect(mockedAxios.get).toHaveBeenCalled()
      expect(response).toEqual(nftDetails)
    })
  })
})
