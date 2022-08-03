import { MigrationInterface, QueryRunner } from 'typeorm'

export class addColumnProfileId1659379151358 implements MigrationInterface {

  name = 'addColumnProfileId1659379151358'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" ADD "profileId" character varying')
    await queryRunner.query('ALTER TABLE "wallet" ADD "profileId" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "wallet" DROP COLUMN "profileId"')
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "profileId"')
  }

}
