import { MigrationInterface, QueryRunner } from 'typeorm'

export class uniqueEventConstraint1660843992119 implements MigrationInterface {

  name = 'uniqueEventConstraint1660843992119'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" DROP CONSTRAINT "UQ_EVENT"')
    await queryRunner.query('ALTER TABLE "event" ADD CONSTRAINT "UQ_e792beb1fe09fa525ee9a1e679c" UNIQUE ("txHash", "profileUrl")')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" DROP CONSTRAINT "UQ_e792beb1fe09fa525ee9a1e679c"')
    await queryRunner.query('ALTER TABLE "event" ADD CONSTRAINT "UQ_EVENT" UNIQUE ("txHash", "profileUrl")')
  }

}
