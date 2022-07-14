import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddChainIdToEntities1657825559008 implements MigrationInterface {

  name = 'AddChainIdToEntities1657825559008'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "bid" ADD "chainId" character varying')
    await queryRunner.query('ALTER TABLE "collection" ADD "chainId" character varying')
    await queryRunner.query('ALTER TABLE "nft" ADD "chainId" character varying')
    await queryRunner.query('ALTER TABLE "profile" ADD "chainId" character varying')
    await queryRunner.query('ALTER TABLE "tx_bid" ADD "chainId" character varying')
    await queryRunner.query('ALTER TABLE "tx_cancel" ADD "chainId" character varying')
    await queryRunner.query('ALTER TABLE "tx_list" ADD "chainId" character varying')
    await queryRunner.query('ALTER TABLE "tx_sale" ADD "chainId" character varying')
    await queryRunner.query('ALTER TABLE "tx_transfer" ADD "chainId" character varying')
    await queryRunner.query('ALTER TABLE "user" ADD "chainId" character varying')
    await queryRunner.query('ALTER TABLE "tx_activity" ADD "chainId" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_activity" DROP COLUMN "chainId"')
    await queryRunner.query('ALTER TABLE "user" DROP COLUMN "chainId"')
    await queryRunner.query('ALTER TABLE "tx_transfer" DROP COLUMN "chainId"')
    await queryRunner.query('ALTER TABLE "tx_sale" DROP COLUMN "chainId"')
    await queryRunner.query('ALTER TABLE "tx_list" DROP COLUMN "chainId"')
    await queryRunner.query('ALTER TABLE "tx_cancel" DROP COLUMN "chainId"')
    await queryRunner.query('ALTER TABLE "tx_bid" DROP COLUMN "chainId"')
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "chainId"')
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "chainId"')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "chainId"')
    await queryRunner.query('ALTER TABLE "bid" DROP COLUMN "chainId"')
  }

}
