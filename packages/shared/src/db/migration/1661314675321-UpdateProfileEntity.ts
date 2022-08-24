import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateProfileEntity1661314675321 implements MigrationInterface {

  name = 'UpdateProfileEntity1661314675321'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ALTER COLUMN "visibleNFTs" SET DEFAULT \'0\'')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ALTER COLUMN "visibleNFTs" DROP DEFAULT')
  }

}
