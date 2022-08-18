import { MigrationInterface, QueryRunner } from 'typeorm'

export class uniqueEventConstraint1660842455466 implements MigrationInterface {

  name = 'uniqueEventConstraint1660842455466'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" ADD CONSTRAINT "UQ_EVENT" UNIQUE ("txHash", "profileUrl")')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" DROP CONSTRAINT "UQ_EVENT"')
  }

}
