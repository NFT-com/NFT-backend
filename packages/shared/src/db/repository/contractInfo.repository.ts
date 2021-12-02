import { ContractInfo } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class ContractInfoRepository extends BaseRepository<ContractInfo> {

  constructor() {
    super(ContractInfo)
  }

}
