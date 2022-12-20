import { MigrationInterface, QueryRunner } from 'typeorm'

export class MarketplaceUpdates1671547755126 implements MigrationInterface {

  name = 'MarketplaceUpdates1671547755126'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_83f602f1b4e1749ca7b9205df4"')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "nftContractTokenId" SET NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "nftContractAddress" SET NOT NULL')
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_protocol_enum_old" AS ENUM(\'Seaport\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "protocol" TYPE "public"."tx_transaction_protocol_enum_old" USING "protocol"::"text"::"public"."tx_transaction_protocol_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_protocol_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_protocol_enum_old" RENAME TO "tx_transaction_protocol_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_transactiontype_enum_old" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "transactionType" TYPE "public"."tx_transaction_transactiontype_enum_old" USING "transactionType"::"text"::"public"."tx_transaction_transactiontype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_transactiontype_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_transactiontype_enum_old" RENAME TO "tx_transaction_transactiontype_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_exchange_enum_old" AS ENUM(\'OpenSea\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "exchange" TYPE "public"."tx_transaction_exchange_enum_old" USING "exchange"::"text"::"public"."tx_transaction_exchange_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_exchange_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_exchange_enum_old" RENAME TO "tx_transaction_exchange_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_order_protocol_enum_old" AS ENUM(\'Seaport\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "protocol" TYPE "public"."tx_order_protocol_enum_old" USING "protocol"::"text"::"public"."tx_order_protocol_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_order_protocol_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_order_protocol_enum_old" RENAME TO "tx_order_protocol_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_order_ordertype_enum_old" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "orderType" TYPE "public"."tx_order_ordertype_enum_old" USING "orderType"::"text"::"public"."tx_order_ordertype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_order_ordertype_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_order_ordertype_enum_old" RENAME TO "tx_order_ordertype_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_order_exchange_enum_old" AS ENUM(\'OpenSea\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "exchange" TYPE "public"."tx_order_exchange_enum_old" USING "exchange"::"text"::"public"."tx_order_exchange_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_order_exchange_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_order_exchange_enum_old" RENAME TO "tx_order_exchange_enum"')
    await queryRunner.query('CREATE INDEX "IDX_83f602f1b4e1749ca7b9205df4" ON "tx_order" ("exchange", "makerAddress", "nonce") ')
    await queryRunner.query('CREATE TYPE "public"."tx_cancel_exchange_enum_old" AS ENUM(\'OpenSea\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_cancel" ALTER COLUMN "exchange" TYPE "public"."tx_cancel_exchange_enum_old" USING "exchange"::"text"::"public"."tx_cancel_exchange_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_cancel_exchange_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_cancel_exchange_enum_old" RENAME TO "tx_cancel_exchange_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_activity_activitytype_enum_old" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('ALTER TABLE "tx_activity" ALTER COLUMN "activityType" TYPE "public"."tx_activity_activitytype_enum_old" USING "activityType"::"text"::"public"."tx_activity_activitytype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_activity_activitytype_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_activity_activitytype_enum_old" RENAME TO "tx_activity_activitytype_enum"')
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "bidOrderId"')
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "listingOrderId"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "memo"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "rejectedAt"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "acceptedAt"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "buyNowTaker"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "listingId"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "swapTransactionId"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "takeAsset"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "makeAsset"')
    // await queryRunner.query('ALTER TABLE "tx_order" ADD "makeAsset" json NOT NULL DEFAULT \'[]\'')
    // await queryRunner.query('ALTER TABLE "tx_order" ADD "takeAsset" json NOT NULL DEFAULT \'[]\'')
    // await queryRunner.query('ALTER TABLE "tx_order" ADD "swapTransactionId" character varying')
    // await queryRunner.query('ALTER TABLE "tx_order" ADD "listingId" character varying')
    // await queryRunner.query('ALTER TABLE "tx_order" ADD "buyNowTaker" character varying')
    // await queryRunner.query('ALTER TABLE "tx_order" ADD "acceptedAt" TIMESTAMP WITH TIME ZONE')
    // await queryRunner.query('ALTER TABLE "tx_order" ADD "rejectedAt" TIMESTAMP WITH TIME ZONE')
    // await queryRunner.query('ALTER TABLE "tx_order" ADD "memo" character varying')
    // await queryRunner.query('ALTER TABLE "tx_transaction" ADD "listingOrderId" character varying')
    // await queryRunner.query('ALTER TABLE "tx_transaction" ADD "bidOrderId" character varying')
    // await queryRunner.query('ALTER TYPE "public"."tx_activity_activitytype_enum" RENAME TO "tx_activity_activitytype_enum_old"')
    // await queryRunner.query('CREATE TYPE "public"."tx_activity_activitytype_enum" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\', \'Swap\')')
    // await queryRunner.query('ALTER TABLE "tx_activity" ALTER COLUMN "activityType" TYPE "public"."tx_activity_activitytype_enum" USING "activityType"::"text"::"public"."tx_activity_activitytype_enum"')
    // await queryRunner.query('DROP TYPE "public"."tx_activity_activitytype_enum_old"')
    // await queryRunner.query('ALTER TYPE "public"."tx_cancel_exchange_enum" RENAME TO "tx_cancel_exchange_enum_old"')
    // await queryRunner.query('CREATE TYPE "public"."tx_cancel_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\', \'X2Y2\', \'NFTCOM\')')
    // await queryRunner.query('ALTER TABLE "tx_cancel" ALTER COLUMN "exchange" TYPE "public"."tx_cancel_exchange_enum" USING "exchange"::"text"::"public"."tx_cancel_exchange_enum"')
    // await queryRunner.query('DROP TYPE "public"."tx_cancel_exchange_enum_old"')
    // await queryRunner.query('DROP INDEX "public"."IDX_83f602f1b4e1749ca7b9205df4"')
    // await queryRunner.query('ALTER TYPE "public"."tx_order_exchange_enum" RENAME TO "tx_order_exchange_enum_old"')
    // await queryRunner.query('CREATE TYPE "public"."tx_order_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\', \'X2Y2\', \'NFTCOM\')')
    // await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "exchange" TYPE "public"."tx_order_exchange_enum" USING "exchange"::"text"::"public"."tx_order_exchange_enum"')
    // await queryRunner.query('DROP TYPE "public"."tx_order_exchange_enum_old"')
    // await queryRunner.query('ALTER TYPE "public"."tx_order_ordertype_enum" RENAME TO "tx_order_ordertype_enum_old"')
    // await queryRunner.query('CREATE TYPE "public"."tx_order_ordertype_enum" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\', \'Swap\')')
    // await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "orderType" TYPE "public"."tx_order_ordertype_enum" USING "orderType"::"text"::"public"."tx_order_ordertype_enum"')
    // await queryRunner.query('DROP TYPE "public"."tx_order_ordertype_enum_old"')
    // await queryRunner.query('ALTER TYPE "public"."tx_order_protocol_enum" RENAME TO "tx_order_protocol_enum_old"')
    // await queryRunner.query('CREATE TYPE "public"."tx_order_protocol_enum" AS ENUM(\'Seaport\', \'LooksRare\', \'X2Y2\', \'NFTCOM\')')
    // await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "protocol" TYPE "public"."tx_order_protocol_enum" USING "protocol"::"text"::"public"."tx_order_protocol_enum"')
    // await queryRunner.query('DROP TYPE "public"."tx_order_protocol_enum_old"')
    // await queryRunner.query('ALTER TYPE "public"."tx_transaction_exchange_enum" RENAME TO "tx_transaction_exchange_enum_old"')
    // await queryRunner.query('CREATE TYPE "public"."tx_transaction_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\', \'X2Y2\', \'NFTCOM\')')
    // await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "exchange" TYPE "public"."tx_transaction_exchange_enum" USING "exchange"::"text"::"public"."tx_transaction_exchange_enum"')
    // await queryRunner.query('DROP TYPE "public"."tx_transaction_exchange_enum_old"')
    // await queryRunner.query('ALTER TYPE "public"."tx_transaction_transactiontype_enum" RENAME TO "tx_transaction_transactiontype_enum_old"')
    // await queryRunner.query('CREATE TYPE "public"."tx_transaction_transactiontype_enum" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\', \'Swap\')')
    // await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "transactionType" TYPE "public"."tx_transaction_transactiontype_enum" USING "transactionType"::"text"::"public"."tx_transaction_transactiontype_enum"')
    // await queryRunner.query('DROP TYPE "public"."tx_transaction_transactiontype_enum_old"')
    // await queryRunner.query('ALTER TYPE "public"."tx_transaction_protocol_enum" RENAME TO "tx_transaction_protocol_enum_old"')
    // await queryRunner.query('CREATE TYPE "public"."tx_transaction_protocol_enum" AS ENUM(\'Seaport\', \'LooksRare\', \'X2Y2\', \'NFTCOM\')')
    // await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "protocol" TYPE "public"."tx_transaction_protocol_enum" USING "protocol"::"text"::"public"."tx_transaction_protocol_enum"')
    // await queryRunner.query('DROP TYPE "public"."tx_transaction_protocol_enum_old"')
    // await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "nftContractAddress" DROP NOT NULL')
    // await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "nftContractTokenId" DROP NOT NULL')
    // await queryRunner.query('CREATE INDEX "IDX_83f602f1b4e1749ca7b9205df4" ON "tx_order" ("makerAddress", "exchange", "nonce") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_83f602f1b4e1749ca7b9205df4"')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "nftContractTokenId" SET NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "nftContractAddress" SET NOT NULL')
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_protocol_enum_old" AS ENUM(\'Seaport\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "protocol" TYPE "public"."tx_transaction_protocol_enum_old" USING "protocol"::"text"::"public"."tx_transaction_protocol_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_protocol_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_protocol_enum_old" RENAME TO "tx_transaction_protocol_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_transactiontype_enum_old" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "transactionType" TYPE "public"."tx_transaction_transactiontype_enum_old" USING "transactionType"::"text"::"public"."tx_transaction_transactiontype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_transactiontype_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_transactiontype_enum_old" RENAME TO "tx_transaction_transactiontype_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_exchange_enum_old" AS ENUM(\'OpenSea\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "exchange" TYPE "public"."tx_transaction_exchange_enum_old" USING "exchange"::"text"::"public"."tx_transaction_exchange_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_exchange_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_exchange_enum_old" RENAME TO "tx_transaction_exchange_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_order_protocol_enum_old" AS ENUM(\'Seaport\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "protocol" TYPE "public"."tx_order_protocol_enum_old" USING "protocol"::"text"::"public"."tx_order_protocol_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_order_protocol_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_order_protocol_enum_old" RENAME TO "tx_order_protocol_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_order_ordertype_enum_old" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "orderType" TYPE "public"."tx_order_ordertype_enum_old" USING "orderType"::"text"::"public"."tx_order_ordertype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_order_ordertype_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_order_ordertype_enum_old" RENAME TO "tx_order_ordertype_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_order_exchange_enum_old" AS ENUM(\'OpenSea\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "exchange" TYPE "public"."tx_order_exchange_enum_old" USING "exchange"::"text"::"public"."tx_order_exchange_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_order_exchange_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_order_exchange_enum_old" RENAME TO "tx_order_exchange_enum"')
    await queryRunner.query('CREATE INDEX "IDX_83f602f1b4e1749ca7b9205df4" ON "tx_order" ("exchange", "makerAddress", "nonce") ')
    await queryRunner.query('CREATE TYPE "public"."tx_cancel_exchange_enum_old" AS ENUM(\'OpenSea\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_cancel" ALTER COLUMN "exchange" TYPE "public"."tx_cancel_exchange_enum_old" USING "exchange"::"text"::"public"."tx_cancel_exchange_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_cancel_exchange_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_cancel_exchange_enum_old" RENAME TO "tx_cancel_exchange_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_activity_activitytype_enum_old" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('ALTER TABLE "tx_activity" ALTER COLUMN "activityType" TYPE "public"."tx_activity_activitytype_enum_old" USING "activityType"::"text"::"public"."tx_activity_activitytype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_activity_activitytype_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_activity_activitytype_enum_old" RENAME TO "tx_activity_activitytype_enum"')
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "bidOrderId"')
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP COLUMN "listingOrderId"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "memo"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "rejectedAt"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "acceptedAt"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "buyNowTaker"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "listingId"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "swapTransactionId"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "takeAsset"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "makeAsset"')
  }

}
