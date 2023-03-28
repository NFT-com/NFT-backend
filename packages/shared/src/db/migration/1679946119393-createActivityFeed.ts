import { MigrationInterface, QueryRunner } from "typeorm";

export class createActivityFeed1679946119393 implements MigrationInterface {
    name = 'createActivityFeed1679946119393'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."activity_feed_erctype_enum" AS ENUM('ERC721', 'ERC1155')`);
        await queryRunner.query(`CREATE TYPE "public"."activity_feed_tradetype_enum" AS ENUM('SALE', 'MINT')`);
        await queryRunner.query(`CREATE TYPE "public"."activity_feed_txcurrency_enum" AS ENUM('ETH', 'WETH', 'BLUR_POOL')`);
        await queryRunner.query(`CREATE TABLE "activity_feed" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "txHash" character varying NOT NULL, "collectionAddress" character varying NOT NULL, "collectionName" character varying, "tokenId" character varying NOT NULL, "ercType" "public"."activity_feed_erctype_enum" NOT NULL, "tokenURI" character varying, "imageURI" character varying, "marketplaceName" character varying, "marketplaceAddress" character varying, "buyerAddress" character varying NOT NULL, "sellerAddress" character varying NOT NULL, "timestamp" character varying NOT NULL, "tradeType" "public"."activity_feed_tradetype_enum" NOT NULL, "txWeiValue" character varying, "txCurrency" "public"."activity_feed_txcurrency_enum", "txValue" character varying, CONSTRAINT "PK_b772f66cacd352e98fba04a7b8a" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "activity_feed"`);
        await queryRunner.query(`DROP TYPE "public"."activity_feed_txcurrency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."activity_feed_tradetype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."activity_feed_erctype_enum"`);
    }

}
