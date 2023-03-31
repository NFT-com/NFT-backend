import { countHiddenNFTs } from './app/query-hidden-nfts'

exports.handler = async (): Promise<void> => {
  await countHiddenNFTs()
}
