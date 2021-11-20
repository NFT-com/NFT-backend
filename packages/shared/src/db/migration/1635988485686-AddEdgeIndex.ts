import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddEdgeIndex1635988485686 implements MigrationInterface {

  name = 'AddEdgeIndex1635988485686'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE INDEX "IDX_4c27707fc3097cd748073acb32" ON "edge" ("collectionId", "edgeType", "thatEntityType", "thatEntityId", "deletedAt") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_4c27707fc3097cd748073acb32"')
  }

}
