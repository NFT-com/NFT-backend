import { MigrationInterface, QueryRunner } from 'typeorm'

export class uniqueEventConstraint1660845965595 implements MigrationInterface {

  name = 'uniqueEventConstraint1660845965595'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" ADD CONSTRAINT "UQ_e792beb1fe09fa525ee9a1e679c" UNIQUE ("txHash", "profileUrl")')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" DROP CONSTRAINT "UQ_e792beb1fe09fa525ee9a1e679c"')
  }

}
