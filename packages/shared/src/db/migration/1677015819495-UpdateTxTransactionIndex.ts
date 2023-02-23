import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateTxTransactionIndex1677015819495 implements MigrationInterface {

  name = 'UpdateTxTransactionIndex1677015819495'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE INDEX "IDX_942ab1c3aa55d964e9bfe2f409" ON "tx_transaction" ("taker") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_942ab1c3aa55d964e9bfe2f409"')
  }

}
