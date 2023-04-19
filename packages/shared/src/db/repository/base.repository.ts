import * as typeorm from 'typeorm'
import { FindManyOptions, FindOneOptions, FindOptionsWhere, IsNull } from 'typeorm'

import { PageableQuery, PageableResult, UpsertOptions } from '../../defs'
import { helper } from '../../helper'
import { db } from '../'

export class BaseRepository<T> {
  private readonly entity: typeorm.EntityTarget<T>
  private repository: typeorm.Repository<T>
  private readOnlyRepository: typeorm.Repository<T>

  public constructor(entity: typeorm.EntityTarget<T>) {
    this.entity = entity
  }

  protected getRepository = (isReadOnly?: boolean): typeorm.Repository<any> => {
    if (isReadOnly) {
      if (this.readOnlyRepository) {
        return this.readOnlyRepository
      }
      this.readOnlyRepository = db.getDataSource(isReadOnly).getRepository(this.entity)
      return this.readOnlyRepository
    }
    if (this.repository) {
      return this.repository
    }
    this.repository = db.getDataSource().getRepository(this.entity)
    return this.repository
  }

  public delete = (opts: FindOptionsWhere<T>): Promise<boolean> => {
    return this.getRepository()
      .softDelete({ where: { ...opts } } as FindOneOptions<Partial<T>>)
      .then(r => r.affected > 0)
  }

  public hardDelete = (opts: typeorm.FindOptionsWhere<Partial<T>>): Promise<boolean> => {
    return this.getRepository()
      .delete(opts)
      .then(r => r.affected > 0)
  }

  public hardDeleteByIds = (ids: string[]): Promise<boolean> => {
    return this.getRepository()
      .delete(ids)
      .then(r => r.affected > 0)
  }

  public deleteById = (id: string): Promise<boolean> => {
    if (id === null || id === undefined) return Promise.reject(`Invalid value of where parameter ${id}`)
    return this.getRepository()
      .softDelete(id)
      .then(r => r.affected === 1)
  }

  public find = (opts: typeorm.FindManyOptions<any>): Promise<T[]> => {
    return this.getRepository(true).find(opts)
  }

  public findAll = (): Promise<T[]> => {
    return this.getRepository(true).find()
  }

  /**
   * Creates a paginated orm query from the provided args.
   * @param {FindManyOptions<Partial<T>>} query - the query to find the pageable result of.
   * @returns {Promise<PageableResult<T>>} - the pageable result of the query.
   */
  public findPageable = ({
    relations,
    order,
    where,
    select,
    skip,
    take,
    cache = true,
  }: FindManyOptions<Partial<T>>): Promise<PageableResult<T>> => {
    const defaultPageSkip = 0
    const defaultPageSize = 5000

    ;[where].flatMap(where => {
      Object.entries(where).reduce((obj, [key, val]) => {
        if (val === null) val = IsNull()
        return { ...obj, [key]: val }
      }, {})
    })

    return this.getRepository(true).findAndCount({
      relations,
      where,
      select,
      order,
      skip: skip || defaultPageSkip,
      take: take || defaultPageSize,
      cache,
    })
  }

  // TODO this doesn't work when distinctOn column does not match with orderBy columns
  //  solution is to use outer query to sort and sub query to find non-dupes/distinct
  public findDistinctPageable = (query: PageableQuery<T>): Promise<PageableResult<T>> => {
    const alias = 'tbl'
    const distinctOn = query.distinctOn.map(k => `${alias}.${k}`)
    const orderBy = Object.keys(query.orderBy).reduce((agg, k) => {
      const nk = `${alias}.${k}`
      return {
        ...agg,
        [nk]: query.orderBy[k],
      }
    }, {})

    return this.getRepository(true)
      .createQueryBuilder(alias)
      .where(query.filters)
      .distinctOn(distinctOn)
      .orderBy(orderBy)
      .take(query.take)
      .cache(true)
      .getManyAndCount()
  }

  public findOne = (opts: typeorm.FindOneOptions<Partial<T>>): Promise<T | undefined> => {
    return this.getRepository(true).findOne(opts)
  }

  public findById = (id: string): Promise<T | undefined> => {
    if (id === null || id === undefined) return Promise.reject(`Invalid value of where parameter ${id}`)
    return this.getRepository(true).findOne({ where: { id } })
  }

  public findByUserId = (userId: string): Promise<T[]> => {
    if (userId === null || userId === undefined) return Promise.reject(`Invalid value of where parameter ${userId}`)
    return this.find({ where: { userId } })
  }

  public save = (entity: typeorm.DeepPartial<T>, opts?: typeorm.SaveOptions): Promise<T> => {
    return this.getRepository().save(this.getRepository().create(entity) as any, opts)
  }

  public saveMany = (entities: typeorm.DeepPartial<T>[], opts?: typeorm.SaveOptions): Promise<T[]> => {
    return this.getRepository().save(this.getRepository().create(entities) as any, opts)
  }

  public updateOneById = (id: string, entity: typeorm.DeepPartial<T>): Promise<T | undefined> => {
    return this.getRepository()
      .update(id, entity as any)
      .then(() => this.findById(id))
  }

  public update = (
    opts: typeorm.FindOptionsWhere<T>,
    entity: typeorm.DeepPartial<T>,
  ): Promise<typeorm.UpdateResult> => {
    return this.getRepository().update(opts, entity as any)
  }

  /* Insert/update (Cascades not supported) */
  public upsert = (entity: typeorm.DeepPartial<T>, opts: UpsertOptions): Promise<typeorm.InsertResult> => {
    return this.getRepository().upsert(this.getRepository().create(entity) as any, opts)
  }

  /* Bulk insert/update (Cascades not supported) */
  public upsertMany = (entities: typeorm.DeepPartial<T>[], opts: UpsertOptions): Promise<typeorm.InsertResult> => {
    return this.getRepository().upsert(entities as any, opts)
  }

  public exists = (opts: FindOptionsWhere<T>): Promise<boolean> => {
    return this.findOne({ where: opts } as FindOneOptions<Partial<T>>).then(helper.isNotEmpty)
  }

  public count = (opts: FindOptionsWhere<T>): Promise<number> => {
    return this.getRepository(true).count({ where: opts })
  }
}
