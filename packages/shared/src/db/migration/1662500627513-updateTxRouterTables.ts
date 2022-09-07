import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateTxRouterTables1662500627513 implements MigrationInterface {

  name = 'updateTxRouterTables1662500627513'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_transaction" RENAME COLUMN "currency" TO "currencyAddress"')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_currency_enum" RENAME TO "tx_transaction_currencyaddress_enum"')
    await queryRunner.query('ALTER TABLE "tx_cancel" ADD "blockNumber" character varying NOT NULL DEFAULT \'0\'')
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "currencyAddress"')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "currencyAddress" character varying NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_activity" ALTER COLUMN "expiration" DROP NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_activity" ALTER COLUMN "expiration" DROP DEFAULT')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_activity" ALTER COLUMN "expiration" SET DEFAULT now()')
    await queryRunner.query('ALTER TABLE "tx_activity" ALTER COLUMN "expiration" SET NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "currencyAddress"')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "currencyAddress" "public"."tx_transaction_currencyaddress_enum" NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_cancel" DROP COLUMN "blockNumber"')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_currencyaddress_enum" RENAME TO "tx_transaction_currency_enum"')
    await queryRunner.query('ALTER TABLE "tx_transaction" RENAME COLUMN "currencyAddress" TO "currency"')
  }

}
