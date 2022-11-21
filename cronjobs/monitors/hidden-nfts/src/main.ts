import { countHiddenNFTs } from './app/query-hidden-nfts'

exports.handler = async (_event: any, _context: any, _callback: any) => {
  await countHiddenNFTs()
}