import { MigrationInterface, QueryRunner } from 'typeorm'

export class createTxTables1656535011209 implements MigrationInterface {

  name = 'createTxTables1656535011209'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."tx_activity_foreigntype_enum" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('CREATE TABLE "tx_activity" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "foreignType" "public"."tx_activity_foreigntype_enum" NOT NULL, "foreignKeyId" character varying NOT NULL, "read" boolean NOT NULL DEFAULT false, "timestamp" TIMESTAMP NOT NULL, "userId" character varying NOT NULL, CONSTRAINT "PK_6e367e6e0098602877808f4e516" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_df3e78c2db8c8937a06b521c9a" ON "tx_activity" ("userId", "timestamp") ')
    await queryRunner.query('CREATE TYPE "public"."tx_bid_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TABLE "tx_bid" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "exchange" "public"."tx_bid_exchange_enum" NOT NULL, CONSTRAINT "PK_03d1588fe81da5ebac29924a68a" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."tx_cancel_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TYPE "public"."tx_cancel_foreigntype_enum" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('CREATE TABLE "tx_cancel" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "exchange" "public"."tx_cancel_exchange_enum" NOT NULL, "foreignType" "public"."tx_cancel_foreigntype_enum" NOT NULL, "foreignKeyId" character varying NOT NULL, "transactionHash" character varying NOT NULL, CONSTRAINT "PK_a35fb271e6009eea9c3b84b9934" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."tx_list_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TABLE "tx_list" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "exchange" "public"."tx_list_exchange_enum" NOT NULL, CONSTRAINT "PK_626af936cae7ce4d0445afd6839" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."tx_sale_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TABLE "tx_sale" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "transactionHash" character varying NOT NULL, "blockNumber" character varying NOT NULL, "nftContractAddress" character varying NOT NULL, "nftContractTokenId" character varying NOT NULL, "sender" character varying NOT NULL, "receiver" character varying NOT NULL, "exchange" "public"."tx_sale_exchange_enum" NOT NULL, "price" character varying NOT NULL, "currency" character varying NOT NULL, CONSTRAINT "PK_bd1388aae6adf6a1352da865da8" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TABLE "tx_transfer" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "transactionHash" character varying NOT NULL, "blockNumber" character varying NOT NULL, "nftContractAddress" character varying NOT NULL, "nftContractTokenId" character varying NOT NULL, "sender" character varying NOT NULL, "receiver" character varying NOT NULL, CONSTRAINT "PK_e38ffe55ceaa7eb747a839fca95" PRIMARY KEY ("id"))')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "tx_transfer"')
    await queryRunner.query('DROP TABLE "tx_sale"')
    await queryRunner.query('DROP TYPE "public"."tx_sale_exchange_enum"')
    await queryRunner.query('DROP TABLE "tx_list"')
    await queryRunner.query('DROP TYPE "public"."tx_list_exchange_enum"')
    await queryRunner.query('DROP TABLE "tx_cancel"')
    await queryRunner.query('DROP TYPE "public"."tx_cancel_foreigntype_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_cancel_exchange_enum"')
    await queryRunner.query('DROP TABLE "tx_bid"')
    await queryRunner.query('DROP TYPE "public"."tx_bid_exchange_enum"')
    await queryRunner.query('DROP INDEX "public"."IDX_df3e78c2db8c8937a06b521c9a"')
    await queryRunner.query('DROP TABLE "tx_activity"')
    await queryRunner.query('DROP TYPE "public"."tx_activity_foreigntype_enum"')
  }

}
