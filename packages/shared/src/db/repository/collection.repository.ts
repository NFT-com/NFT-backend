import { Collection, NFT } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class CollectionRepository extends BaseRepository<Collection> {

  constructor() {
    super(Collection)
  }

  public findByContractAddress = (address: string, chainId: string): Promise<Collection> => {
    return this.findOne({
      where: { contract: address, deletedAt: null, chainId },
    })
  }

  findAllWithAnNft(): Promise<Collection[]> {
    return this.getRepository(true)
      .createQueryBuilder('collection')
      .leftJoinAndMapOne('collection.nft', NFT,
        'nft', 'collection.contract = nft.contract')
      .getMany()
  }

  findAllOfficial(): Promise<Collection[]> {
    return this.getRepository(true).find({
      where: {
        isOfficial: true,
      },
    })
  }

}
