import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDeletedByToEdgeKey1637606738334 implements MigrationInterface {

  name = 'AddDeletedByToEdgeKey1637606738334'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_05675ffabd0e7411d60f1c8a3f"')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_6daf260f04aad49c0e164fe8ac" ON "edge" ("collectionId", "edgeType", "thatEntityId", "thisEntityId", "deletedAt") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_6daf260f04aad49c0e164fe8ac"')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_05675ffabd0e7411d60f1c8a3f" ON "edge" ("collectionId", "thisEntityId", "thatEntityId", "edgeType") ')
  }

}
