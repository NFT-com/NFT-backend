import { getNFTPortInterceptor } from './nftport-interceptor'

describe('nftport-interceptor', () => {
  it('should get an Axios instance from getNFTPortInterceptor', () => {
    const axios = getNFTPortInterceptor('http://test.nft.fake')
    expect(axios.defaults.baseURL).toEqual('http://test.nft.fake')
    expect(axios.defaults.headers['Content-Type']).toEqual('application/json')
  })
})
