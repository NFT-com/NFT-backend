import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddNftVisibility1652806171537 implements MigrationInterface {

  name = 'AddNftVisibility1652806171537'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" ALTER COLUMN "visibility" DROP NOT NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" ALTER COLUMN "visibility" SET NOT NULL')
  }

}
