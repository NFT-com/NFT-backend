import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateProfileEntity1656383676018 implements MigrationInterface {

  name = 'updateProfileEntity1656383676018'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ADD "lastScored" TIMESTAMP WITH TIME ZONE')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "lastScored"')
  }

}
