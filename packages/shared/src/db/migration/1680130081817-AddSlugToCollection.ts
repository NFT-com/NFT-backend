import { MigrationInterface, QueryRunner, TableColumn } from "typeorm"
import { Collection } from "../entity"
import { generateSlug } from "@nftcom/shared/helper/misc"
import chunk from "lodash/chunk";

export class AddSlugToCollection1680130081817 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add slug column to collection table
    await queryRunner.addColumn(
      "collection",
      new TableColumn({
        name: "slug",
        type: "varchar",
        isNullable: true,
        isUnique: true,
      })
    );

    const batchSize = 1000 // Used to break up upsert query size
    const repo = queryRunner.manager.getRepository(Collection);
    const allCollections = await repo.find({
      order: {
        isOfficial: "DESC",
        createdAt: "ASC",
      },
    })

    const updatedCollections = allCollections.reduce((updatedCollections, collection) => {
      collection.slug = generateSlug({ value: collection.name })
      const matchCount = updatedCollections.filter(
        (updatedCollection) => updatedCollection.slug.includes(collection.slug)
      ).length;
      if (matchCount > 0) {
        collection.slug = `${collection.slug}-${matchCount + 1}`
      }
      updatedCollections.push(collection)
      return updatedCollections
    }, [] as Collection[])

    const batchedUpdates = chunk(updatedCollections, batchSize)

    await Promise.all(
      // Upsert updates all collection entities due since all ids are the same.
      batchedUpdates.map(batch => repo.upsert(batch,
        {
          conflictPaths: ['id'],
          skipUpdateIfNoValuesChanged: true
        }))
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("collection", "slug");
  }

}
