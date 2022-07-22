import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddColumn1658438703296 implements MigrationInterface {

  name = 'AddColumn1658438703296'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" ADD "blockNumber" integer')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" DROP COLUMN "blockNumber"')
  }

}
