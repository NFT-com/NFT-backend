import { MigrationInterface, QueryRunner, TableColumn } from "typeorm"
import { Collection } from "../entity"
import { generateSlug } from "@nftcom/shared/helper/misc"

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

    const repo = queryRunner.manager.getRepository(Collection);
    const saveChunkSize = 10000; // breaks up large insertions
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

    function chunk<T>(arr: T[], chunkSize: number): T[][] {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += chunkSize) {
        chunks.push(arr.slice(i, i + chunkSize));
      }
      return chunks;
    }

    const batchedUpdates = chunk(updatedCollections, 1000);
    await Promise.all(
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
