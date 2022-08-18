import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateCollectionEntity1660847770122 implements MigrationInterface {

  name = 'UpdateCollectionEntity1660847770122'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" ADD "isSpam" boolean NOT NULL DEFAULT false')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "isSpam"')
  }

}
