import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHideCustomizationToProfile1680030687335 implements MigrationInterface {
    name = 'AddHideCustomizationToProfile1680030687335'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."activity_feed_erctype_enum" AS ENUM('ERC721', 'ERC1155')`);
        await queryRunner.query(`CREATE TYPE "public"."activity_feed_tradetype_enum" AS ENUM('SALE', 'MINT')`);
        await queryRunner.query(`CREATE TYPE "public"."activity_feed_txcurrency_enum" AS ENUM('ETH', 'WETH', 'BLUR_POOL')`);
        await queryRunner.query(`CREATE TABLE "activity_feed" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "txHash" character varying NOT NULL, "collectionAddress" character varying NOT NULL, "collectionName" character varying, "tokenId" character varying NOT NULL, "ercType" "public"."activity_feed_erctype_enum" NOT NULL, "tokenURI" character varying, "imageURI" character varying, "marketplaceName" character varying, "marketplaceAddress" character varying, "buyerAddress" character varying NOT NULL, "sellerAddress" character varying NOT NULL, "timestamp" character varying NOT NULL, "tradeType" "public"."activity_feed_tradetype_enum" NOT NULL, "txWeiValue" character varying, "txCurrency" "public"."activity_feed_txcurrency_enum", "txValue" character varying, CONSTRAINT "PK_b772f66cacd352e98fba04a7b8a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "profile" ADD "hideCustomization" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TYPE "public"."tx_activity_activitytype_enum" RENAME TO "tx_activity_activitytype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."tx_activity_activitytype_enum" AS ENUM('Listing', 'Bid', 'Cancel', 'Sale', 'Purchase', 'Transfer', 'Swap')`);
        await queryRunner.query(`ALTER TABLE "tx_activity" ALTER COLUMN "activityType" TYPE "public"."tx_activity_activitytype_enum" USING "activityType"::"text"::"public"."tx_activity_activitytype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tx_activity_activitytype_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."tx_order_ordertype_enum" RENAME TO "tx_order_ordertype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."tx_order_ordertype_enum" AS ENUM('Listing', 'Bid', 'Cancel', 'Sale', 'Purchase', 'Transfer', 'Swap')`);
        await queryRunner.query(`ALTER TABLE "tx_order" ALTER COLUMN "orderType" TYPE "public"."tx_order_ordertype_enum" USING "orderType"::"text"::"public"."tx_order_ordertype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tx_order_ordertype_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."tx_transaction_transactiontype_enum" RENAME TO "tx_transaction_transactiontype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."tx_transaction_transactiontype_enum" AS ENUM('Listing', 'Bid', 'Cancel', 'Sale', 'Purchase', 'Transfer', 'Swap')`);
        await queryRunner.query(`ALTER TABLE "tx_transaction" ALTER COLUMN "transactionType" TYPE "public"."tx_transaction_transactiontype_enum" USING "transactionType"::"text"::"public"."tx_transaction_transactiontype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tx_transaction_transactiontype_enum_old"`);
        await queryRunner.query(`ALTER TABLE "view" DROP COLUMN "viewerType"`);
        await queryRunner.query(`DROP TYPE "public"."view_viewertype_enum"`);
        await queryRunner.query(`ALTER TABLE "view" ADD "viewerType" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "view" DROP COLUMN "viewerType"`);
        await queryRunner.query(`CREATE TYPE "public"."view_viewertype_enum" AS ENUM('Profile Holder', 'User', 'Visitor')`);
        await queryRunner.query(`ALTER TABLE "view" ADD "viewerType" "public"."view_viewertype_enum" NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."tx_transaction_transactiontype_enum_old" AS ENUM('Listing', 'Bid', 'Cancel', 'Sale', 'Transfer', 'Swap')`);
        await queryRunner.query(`ALTER TABLE "tx_transaction" ALTER COLUMN "transactionType" TYPE "public"."tx_transaction_transactiontype_enum_old" USING "transactionType"::"text"::"public"."tx_transaction_transactiontype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."tx_transaction_transactiontype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."tx_transaction_transactiontype_enum_old" RENAME TO "tx_transaction_transactiontype_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."tx_order_ordertype_enum_old" AS ENUM('Listing', 'Bid', 'Cancel', 'Sale', 'Transfer', 'Swap')`);
        await queryRunner.query(`ALTER TABLE "tx_order" ALTER COLUMN "orderType" TYPE "public"."tx_order_ordertype_enum_old" USING "orderType"::"text"::"public"."tx_order_ordertype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."tx_order_ordertype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."tx_order_ordertype_enum_old" RENAME TO "tx_order_ordertype_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."tx_activity_activitytype_enum_old" AS ENUM('Listing', 'Bid', 'Cancel', 'Sale', 'Transfer', 'Swap')`);
        await queryRunner.query(`ALTER TABLE "tx_activity" ALTER COLUMN "activityType" TYPE "public"."tx_activity_activitytype_enum_old" USING "activityType"::"text"::"public"."tx_activity_activitytype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."tx_activity_activitytype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."tx_activity_activitytype_enum_old" RENAME TO "tx_activity_activitytype_enum"`);
        await queryRunner.query(`ALTER TABLE "profile" DROP COLUMN "hideCustomization"`);
        await queryRunner.query(`DROP TABLE "activity_feed"`);
        await queryRunner.query(`DROP TYPE "public"."activity_feed_txcurrency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."activity_feed_tradetype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."activity_feed_erctype_enum"`);
    }

}
