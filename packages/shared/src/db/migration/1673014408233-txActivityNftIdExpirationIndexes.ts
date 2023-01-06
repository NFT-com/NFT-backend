import { MigrationInterface, QueryRunner } from 'typeorm'

export class txActivityNftIdExpirationIndexes1673014408233 implements MigrationInterface {

  name = 'txActivityNftIdExpirationIndexes1673014408233'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE INDEX "IDX_30515d2ad413e74246306659d3" ON "tx_activity" ("expiration") ')
    await queryRunner.query('CREATE INDEX "idx_tx_activity_nftid" ON "tx_activity" USING GIN ("nftId") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_30515d2ad413e74246306659d3"')
    await queryRunner.query('DROP INDEX "public"."idx_tx_activity_nftid"')
  }

}
