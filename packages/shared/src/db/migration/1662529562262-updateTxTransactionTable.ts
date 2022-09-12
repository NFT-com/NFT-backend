import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateTxTransactionTablel1662529562262 implements MigrationInterface {

  name = 'updateTxTransactionTable1662529562262'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "price"')
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "currencyAddress"')
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_protocol_enum" AS ENUM(\'Seaport\', \'LooksRare\')')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "protocol" "public"."tx_transaction_protocol_enum" NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "protocolData" json NOT NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "protocolData"')
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "protocol"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_protocol_enum"')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "currencyAddress" character varying NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD "price" character varying NOT NULL')
  }

}
