import * as typeorm from 'typeorm'

import { PageableQuery, PageableResult } from '@nftcom/shared/defs'
import { helper } from '@nftcom/shared/helper'

export class BaseRepository<T> {

  private readonly entity: typeorm.EntityTarget<T>
  private repository: typeorm.Repository<T>

  public constructor(entity: typeorm.EntityTarget<T>) {
    this.entity = entity
  }

  protected getRepository = (): typeorm.Repository<T> => {
    if (this.repository) {
      return this.repository
    }
    this.repository = typeorm.getConnection().getRepository(this.entity)
    return this.repository
  }

  public delete = (opts: typeorm.FindConditions<T>): Promise<boolean> => {
    return this.getRepository().softDelete(opts)
      .then((r) => r.affected > 0)
  }

  public deleteById = (id: string): Promise<boolean> => {
    return this.getRepository().softDelete(id)
      .then((r) => r.affected === 1)
  }

  public find = (opts: typeorm.FindManyOptions<T>): Promise<T[]> => {
    return this.getRepository().find(opts)
  }

  public findPageable = (query: PageableQuery<T>): Promise<PageableResult<T>> => {
    return this.getRepository()
      .findAndCount({
        where: query.filter,
        order: query.orderBy,
        take: query.take,
        cache: true,
      })
  }

  // TODO this doesn't work when distinctOn column does not match with orderBy columns
  //  solution is to use outer query to sort and sub query to find non-dupes/distinct
  public findDistinctPageable = (query: PageableQuery<T>): Promise<PageableResult<T>> => {
    const alias = 'tbl'
    const distinctOn = query.distinctOn.map((k) => `${alias}.${k}`)
    const orderBy = Object.keys(query.orderBy)
      .reduce((agg, k) => {
        const nk = `${alias}.${k}`
        return {
          ...agg,
          [nk]: query.orderBy[k],
        }
      }, {})

    return this.getRepository()
      .createQueryBuilder(alias)
      .where(query.filter)
      .distinctOn(distinctOn)
      .orderBy(orderBy)
      .take(query.take)
      .cache(true)
      .getManyAndCount()
  }

  public findOne = (opts: typeorm.FindOneOptions<T>): Promise<T | undefined> => {
    return this.getRepository().findOne(opts)
    // .then(fp.thruIf<T>(isNil)(fp.N))
  }

  public findById = (id: string): Promise<T | undefined> => {
    return this.getRepository().findOne(id)
    // .then(fp.thruIf<T>(isNil)(fp.N))
  }

  public findByUserId = (userId: string): Promise<T[]> => {
    return this.find({ where: { userId } })
  }

  public save = (entity: typeorm.DeepPartial<T>, opts?: typeorm.SaveOptions): Promise<T> => {
    return this.getRepository().save(this.getRepository().create(entity), opts)
  }

  // eslint-disable-next-line max-len
  public saveMany = (entities: T[], opts?: typeorm.SaveOptions): Promise<DeepPartial<T>[]> => {
    return this.getRepository().save(this.getRepository().create(entities), opts)
  }

  public updateOneById = (
    id: string,
    entity: typeorm.DeepPartial<T>,
  ): Promise<T | undefined> => {
    return this.getRepository().update(id, entity)
      .then(() => this.findById(id))
  }

  public update = (
    opts: typeorm.FindConditions<T>,
    entity: typeorm.DeepPartial<T>,
  ): Promise<typeorm.UpdateResult> => {
    return this.getRepository().update(opts, entity)
  }

  public exists = (opts: Partial<T>): Promise<boolean> => {
    return this.findOne({ where: { ...opts } }).then(helper.isNotEmpty)
  }

  public count = (opts: Partial<T>): Promise<number> => {
    return this.getRepository().count(opts)
  }

}
