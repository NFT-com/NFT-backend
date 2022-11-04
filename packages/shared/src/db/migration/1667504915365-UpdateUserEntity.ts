import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateUserEntity1667504915365 implements MigrationInterface {

  name = 'UpdateUserEntity1667504915365'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user" DROP COLUMN "referralEmailInfo"')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user" ADD "referralEmailInfo" character varying')
  }

}
