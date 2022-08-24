import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateTxTables1661273732693 implements MigrationInterface {

  name = 'updateTxTables1661273732693'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_a4ef34e6c04bb75a6fb5be1600"')
    await queryRunner.query('ALTER TABLE "tx_activity" DROP COLUMN "walletId"')
    await queryRunner.query('ALTER TABLE "tx_activity" ADD "nftId" text array NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_activity" ADD "walletAddress" character varying NOT NULL')
    await queryRunner.query('CREATE INDEX "IDX_517eda0666b386ea53ae6f3898" ON "tx_activity" ("walletAddress", "timestamp") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_517eda0666b386ea53ae6f3898"')
    await queryRunner.query('ALTER TABLE "tx_activity" DROP COLUMN "walletAddress"')
    await queryRunner.query('ALTER TABLE "tx_activity" DROP COLUMN "nftId"')
    await queryRunner.query('ALTER TABLE "tx_activity" ADD "walletId" character varying NOT NULL')
    await queryRunner.query('CREATE INDEX "IDX_a4ef34e6c04bb75a6fb5be1600" ON "tx_activity" ("timestamp", "walletId") ')
  }

}
