import * as typeorm from 'typeorm'
import { isNil } from 'lodash'

import { fp } from '@src/helper'

export class BaseRepository<T> {

  private readonly entity: typeorm.EntityTarget<T>
  private repository: typeorm.Repository<T>

  public constructor(entity: typeorm.EntityTarget<T>) {
    this.entity = entity
  }

  protected getRepository = (): typeorm.Repository<T> => {
    if (this.repository)
      return this.repository

    const repository = typeorm.getConnection().getRepository(this.entity)
    this.repository = repository
    return repository
  }

  public delete = (opts: typeorm.FindConditions<T>): Promise<typeorm.DeleteResult> => {
    return this.getRepository().delete(opts)
  }

  public deleteById = (id: string): Promise<typeorm.DeleteResult> => {
    return this.getRepository().delete(id)
  }

  public find = (opts: typeorm.FindManyOptions<T>): Promise<T[]> => {
    return this.getRepository().find(opts)
  }

  public findOne = (opts: typeorm.FindOneOptions<T>): Promise<T | null> => {
    return this.getRepository().findOne(opts)
      .then(fp.thruIf<T>(isNil)(fp.N))
  }

  public findById = (id: string): Promise<T | null> => {
    return this.getRepository().findOne(id)
      .then(fp.thruIf<T>(isNil)(fp.N))
  }

  public save = (entity: typeorm.DeepPartial<T>, opts?: typeorm.SaveOptions): Promise<T> => {
    return this.getRepository().save(entity, opts)
  }

  public updateOneById = (
    id: string,
    entity: typeorm.DeepPartial<T>,
  ): Promise<typeorm.UpdateResult> => {
    return this.getRepository().update(id, entity)
  }

  public update = (
    opts: typeorm.FindConditions<T>,
    entity: typeorm.DeepPartial<T>,
  ): Promise<typeorm.UpdateResult> => {
    return this.getRepository().update(opts, entity)
  }

  public exists = (opts: Partial<T>): Promise<boolean> => {
    return this.find({ where: { ...opts } }).then((list) => list.length > 0)
  }

}
