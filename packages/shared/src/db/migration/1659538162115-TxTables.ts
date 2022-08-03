import { MigrationInterface, QueryRunner } from 'typeorm'

export class TxTables1659538162115 implements MigrationInterface {

  name = 'TxTables1659538162115'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_df3e78c2db8c8937a06b521c9a"')
    await queryRunner.query('ALTER TABLE "tx_activity" RENAME COLUMN "userId" TO "walletId"')
    await queryRunner.query('ALTER TABLE "nft" ADD "memo" character varying(2000)')
    await queryRunner.query('CREATE INDEX "IDX_a4ef34e6c04bb75a6fb5be1600" ON "tx_activity" ("walletId", "timestamp") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_a4ef34e6c04bb75a6fb5be1600"')
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "memo"')
    await queryRunner.query('ALTER TABLE "tx_activity" RENAME COLUMN "walletId" TO "userId"')
    await queryRunner.query('CREATE INDEX "IDX_df3e78c2db8c8937a06b521c9a" ON "tx_activity" ("timestamp", "userId") ')
  }

}
