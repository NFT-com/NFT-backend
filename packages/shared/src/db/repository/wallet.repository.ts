import { Wallet } from '../entity'
import { BaseRepository } from './base.repository'

export class WalletRepository extends BaseRepository<Wallet> {
  constructor() {
    super(Wallet)
  }

  public findByChainAddress = (chainId: string, address: string): Promise<Wallet | undefined> => {
    return this.findOne({ where: { chainId, address } })
  }

  public findByNetworkChainAddress = (
    network: string,
    chainId: string,
    address: string,
  ): Promise<Wallet | undefined> => {
    return this.findOne({ where: { network, chainId, address } })
  }
}
