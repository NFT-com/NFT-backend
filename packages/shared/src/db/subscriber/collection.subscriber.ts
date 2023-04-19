/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EntitySubscriberInterface, EventSubscriber, ILike, InsertEvent } from 'typeorm'

import { generateSlug } from '../../helper/misc'
import { Collection } from '../entity'

/**
 * A subscriber class that listens to events related to the Collection entity.
 */
@EventSubscriber()
export class CollectionSubscriber implements EntitySubscriberInterface<Collection> {
  listenTo() {
    return Collection
  }

  /**
   * This function is called before a new entity is inserted into the Collection table.
   * It generates a unique slug for the entity's name and assigns it to the entity's slug property.
   * @param {InsertEvent<Collection>} event - The insert event object.
   * @returns {Promise<any>} - A promise that resolves when the slug has been generated and assigned to the entity.
   */
  async beforeInsert(event: InsertEvent<Collection>): Promise<any> {
    const { entity, manager } = event
    const initialSlug = generateSlug({ value: entity.name })

    // Find most recent matching collection slug
    const match = await manager.getRepository(Collection).findOne({
      where: {
        slug: ILike(`%${initialSlug}%`),
      },
      select: {
        slug: true,
      },
      order: {
        slug: 'DESC',
      },
    })

    // Note: Entity is automatically persisted/saved by TypeORM after event completion
    entity.slug = initialSlug
    if (match) {
      const matchSlug = match.slug
      const matchCount = parseInt(matchSlug.slice(matchSlug.lastIndexOf('-') + 1))
      entity.slug = `${initialSlug}-${matchCount + 1}`
    }
  }
}
