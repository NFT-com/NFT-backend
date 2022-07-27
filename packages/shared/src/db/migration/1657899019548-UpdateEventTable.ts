import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateEventTable1657899019548 implements MigrationInterface {

  name = 'UpdateEventTable1657899019548'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" ADD "destinationAddress" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" DROP COLUMN "destinationAddress"')
  }

}
