import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateTypes1672772860885 implements MigrationInterface {
    
  name = 'updateTypes1672772860885'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "public"."tx_activity_activitytype_enum" ADD VALUE \'Swap\'')
    await queryRunner.query('ALTER TYPE "public"."tx_cancel_exchange_enum" ADD VALUE \'NFTCOM\'')
    await queryRunner.query('DROP INDEX "public"."IDX_83f602f1b4e1749ca7b9205df4"')
    await queryRunner.query('ALTER TYPE "public"."tx_order_exchange_enum" ADD VALUE \'NFTCOM\'')
    await queryRunner.query('ALTER TYPE "public"."tx_order_ordertype_enum" ADD VALUE \'Swap\'')
    await queryRunner.query('ALTER TYPE "public"."tx_order_protocol_enum" ADD VALUE \'NFTCOM\'')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_exchange_enum" ADD VALUE \'NFTCOM\'')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_transactiontype_enum" ADD VALUE \'Swap\'')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_protocol_enum" ADD VALUE \'NFTCOM\'')
    await queryRunner.query('CREATE INDEX "IDX_83f602f1b4e1749ca7b9205df4" ON "tx_order" ("makerAddress", "exchange", "nonce") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('This migration cannot be fully undone -- ¯\\_(ツ)_/¯')
    await queryRunner.query('DROP INDEX "public"."IDX_83f602f1b4e1749ca7b9205df4"')
    await queryRunner.query('CREATE INDEX "IDX_83f602f1b4e1749ca7b9205df4" ON "tx_order" ("exchange", "makerAddress", "nonce") ')
  }

}
