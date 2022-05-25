import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddProfileGKIconBool1653499931604 implements MigrationInterface {

  name = 'AddProfileGKIconBool1653499931604'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ADD "gkIconVisible" boolean')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "gkIconVisible"')
  }

}
