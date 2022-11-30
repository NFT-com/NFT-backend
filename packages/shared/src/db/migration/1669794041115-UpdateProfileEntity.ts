import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateProfileEntity1669794041115 implements MigrationInterface {

  name = 'UpdateProfileEntity1669794041115'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ADD "expireAt" TIMESTAMP WITH TIME ZONE')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "expireAt"')
  }

}
