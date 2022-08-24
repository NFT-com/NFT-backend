import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateProfileEntity1661310429048 implements MigrationInterface {

  name = 'UpdateProfileEntity1661310429048'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ADD "visibleNFTs" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "visibleNFTs"')
  }

}
