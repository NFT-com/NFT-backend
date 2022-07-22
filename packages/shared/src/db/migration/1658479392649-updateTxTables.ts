import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateTxTables1658479392649 implements MigrationInterface {

  name = 'updateTxTables1658479392649'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_df3e78c2db8c8937a06b521c9a"')
    await queryRunner.query('CREATE INDEX "IDX_df3e78c2db8c8937a06b521c9a" ON "tx_activity" ("userId", "timestamp") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_df3e78c2db8c8937a06b521c9a"')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_df3e78c2db8c8937a06b521c9a" ON "tx_activity" ("timestamp", "userId") ')
  }

}
