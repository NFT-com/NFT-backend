import { getNFTPortInterceptor } from './nftport-client'

describe('nftportClient', () => {
  it('should get an Axios instance from getNFTPortInterceptor', () => {
    const axios = getNFTPortInterceptor('http://test.nft.fake')
    expect(axios.defaults.baseURL).toEqual('http://test.nft.fake')
    expect(axios.defaults.headers['Content-Type']).toEqual('application/json')
  })
})
