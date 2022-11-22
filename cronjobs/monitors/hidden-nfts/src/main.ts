import { countHiddenNFTs } from './app/query-hidden-nfts'

exports.handler = async (_event: any, _context: any, _callback: any) => {
  const output = await countHiddenNFTs()
  console.log({ output })
}