import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateCollectionEntity1663783807276 implements MigrationInterface {

  name = 'UpdateCollectionEntity1663783807276'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" ADD "isOfficial" boolean NOT NULL DEFAULT false')
    await queryRunner.query('ALTER TABLE "marketplace_sale" ADD "price" numeric')
    await queryRunner.query('ALTER TABLE "marketplace_sale" ADD "symbol" character varying NOT NULL DEFAULT \'\'')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "marketplace_sale" DROP COLUMN "symbol"')
    await queryRunner.query('ALTER TABLE "marketplace_sale" DROP COLUMN "price"')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "isOfficial"')
  }

}
