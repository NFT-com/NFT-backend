import { MigrationInterface, QueryRunner } from 'typeorm'

export class createVisibilityColumn1652756094608 implements MigrationInterface {

  name = 'createVisibilityColumn1652756094608'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "showGallery"')
    await queryRunner.query('ALTER TABLE "nft" ADD "visibility" boolean NOT NULL')
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "nftsLastUpdated"')
    await queryRunner.query('ALTER TABLE "profile" ADD "nftsLastUpdated" TIMESTAMP WITH TIME ZONE')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "nftsLastUpdated"')
    await queryRunner.query('ALTER TABLE "profile" ADD "nftsLastUpdated" character varying')
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "visibility"')
    await queryRunner.query('ALTER TABLE "profile" ADD "showGallery" boolean')
  }

}
