import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddIgnore1658446456990 implements MigrationInterface {

  name = 'AddIgnore1658446456990'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" ADD "ignore" boolean NOT NULL DEFAULT false')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" DROP COLUMN "ignore"')
  }

}
