import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateProfileEntity1659735010264 implements MigrationInterface {

  name = 'UpdateProfileEntity1659735010264'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ADD "associatedContract" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "associatedContract"')
  }

}
