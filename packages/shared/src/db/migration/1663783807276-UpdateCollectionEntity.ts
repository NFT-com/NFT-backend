import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateCollectionEntity1663783807276 implements MigrationInterface {

  name = 'UpdateCollectionEntity1663783807276'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" ADD "isOfficial" boolean NOT NULL DEFAULT false')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "isOfficial"')
  }

}
