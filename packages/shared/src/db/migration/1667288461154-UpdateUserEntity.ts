import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateUserEntity1667288461154 implements MigrationInterface {

  name = 'UpdateUserEntity1667288461154'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user" ADD "referralEmailInfo" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user" DROP COLUMN "referralEmailInfo"')
  }

}
