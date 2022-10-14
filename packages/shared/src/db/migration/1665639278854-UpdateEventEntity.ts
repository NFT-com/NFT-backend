import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateEventEntity1665639278854 implements MigrationInterface {

  name = 'UpdateEventEntity1665639278854'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" ADD "tokenId" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" DROP COLUMN "tokenId"')
  }

}
