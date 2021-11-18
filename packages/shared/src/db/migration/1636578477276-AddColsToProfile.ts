import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddColsToProfile1636578477276 implements MigrationInterface {

  name = 'AddColsToProfile1636578477276'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ADD "photoURL" character varying')
    await queryRunner.query('ALTER TABLE "profile" ADD "description" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "description"')
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "photoURL"')
  }

}
