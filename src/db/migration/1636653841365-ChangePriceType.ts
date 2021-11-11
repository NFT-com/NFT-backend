import { MigrationInterface, QueryRunner } from 'typeorm'

export class ChangePriceType1636653841365 implements MigrationInterface {

  name = 'ChangePriceType1636653841365'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "approval" DROP COLUMN "amount"')
    await queryRunner.query('ALTER TABLE "approval" ADD "amount" character varying NOT NULL')
    await queryRunner.query('DROP INDEX "public"."IDX_2ce892175f30a263d7f2a48890"')
    await queryRunner.query('ALTER TABLE "bid" DROP COLUMN "price"')
    await queryRunner.query('ALTER TABLE "bid" ADD "price" character varying NOT NULL')
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "price"')
    await queryRunner.query('ALTER TABLE "nft" ADD "price" character varying NOT NULL')
    await queryRunner.query('CREATE INDEX "IDX_2ce892175f30a263d7f2a48890" ON "bid" ("profileId", "deletedAt", "price") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_2ce892175f30a263d7f2a48890"')
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "price"')
    await queryRunner.query('ALTER TABLE "nft" ADD "price" integer NOT NULL')
    await queryRunner.query('ALTER TABLE "bid" DROP COLUMN "price"')
    await queryRunner.query('ALTER TABLE "bid" ADD "price" integer NOT NULL')
    await queryRunner.query('CREATE INDEX "IDX_2ce892175f30a263d7f2a48890" ON "bid" ("deletedAt", "profileId", "price") ')
    await queryRunner.query('ALTER TABLE "approval" DROP COLUMN "amount"')
    await queryRunner.query('ALTER TABLE "approval" ADD "amount" integer NOT NULL')
  }

}
