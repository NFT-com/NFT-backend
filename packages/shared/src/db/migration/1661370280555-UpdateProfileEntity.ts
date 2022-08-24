import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateProfileEntity1661370280555 implements MigrationInterface {

  name = 'UpdateProfileEntity1661370280555'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ADD "visibleNFTs" integer DEFAULT \'0\'')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "visibleNFTs"')
  }

}
