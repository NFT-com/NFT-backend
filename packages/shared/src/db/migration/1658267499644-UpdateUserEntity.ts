import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateUserEntity1658267499644 implements MigrationInterface {

  name = 'UpdateUserEntity1658267499644'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user" DROP COLUMN "chainId"')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user" ADD "chainId" character varying')
  }

}
