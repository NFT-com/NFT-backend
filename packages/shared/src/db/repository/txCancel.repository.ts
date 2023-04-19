import { TxCancel } from '../entity'
import { BaseRepository } from './base.repository'

export class TxCancelRepository extends BaseRepository<TxCancel> {
  constructor() {
    super(TxCancel)
  }
}
