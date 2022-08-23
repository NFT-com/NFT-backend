import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateProfileEntity1661285438999 implements MigrationInterface {

  name = 'UpdateProfileEntity1661285438999'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ADD "lastCustomized" TIMESTAMP WITH TIME ZONE')
    await queryRunner.query('ALTER TABLE "event" ADD CONSTRAINT "UQ_e792beb1fe09fa525ee9a1e679c" UNIQUE ("txHash", "profileUrl")')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event" DROP CONSTRAINT "UQ_e792beb1fe09fa525ee9a1e679c"')
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "lastCustomized"')
  }

}
