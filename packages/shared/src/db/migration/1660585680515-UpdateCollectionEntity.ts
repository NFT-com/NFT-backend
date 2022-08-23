import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateCollectionEntity1660585680515 implements MigrationInterface {

  name = 'UpdateCollectionEntity1660585680515'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" ADD "bannerUrl" character varying')
    await queryRunner.query('ALTER TABLE "collection" ADD "logoUrl" character varying')
    await queryRunner.query('ALTER TABLE "collection" ADD "description" character varying')
    await queryRunner.query('ALTER TABLE "collection" ADD "isCurated" boolean DEFAULT false')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "isCurated"')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "description"')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "logoUrl"')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "bannerUrl"')
  }

}
