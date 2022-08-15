import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateEventEntity1660157656342 implements MigrationInterface {

  name = 'UpdateEventEntity1660157656342'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" ADD "hidden" boolean NOT NULL DEFAULT false')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" DROP COLUMN "hidden"')
  }

}
