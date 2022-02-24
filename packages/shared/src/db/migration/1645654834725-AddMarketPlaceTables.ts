import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMarketPlaceTables1645654834725 implements MigrationInterface {

  name = 'AddMarketPlaceTables1645654834725'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."market_ask_auctiontype_enum" AS ENUM(\'FixedPrice\', \'English\', \'Decreasing\')')
    await queryRunner.query('CREATE TABLE "market_ask" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "structHash" character varying NOT NULL, "auctionType" "public"."market_ask_auctiontype_enum" NOT NULL, "signature" json NOT NULL, "makerAddress" character varying NOT NULL, "makeAsset" json NOT NULL DEFAULT \'[]\', "takerAddress" character varying NOT NULL, "takeAsset" json NOT NULL DEFAULT \'[]\', "start" character varying NOT NULL, "end" character varying NOT NULL, "salt" integer NOT NULL, "offerAcceptedAt" TIMESTAMP WITH TIME ZONE, "chainId" character varying NOT NULL, CONSTRAINT "PK_0e14a9d9529711138496a7f50f9" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TABLE "market_bid" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "structHash" character varying NOT NULL, "signature" json NOT NULL, "marketAskId" character varying NOT NULL, "makerAddress" character varying NOT NULL, "nonce" integer NOT NULL, "makeAsset" json NOT NULL DEFAULT \'[]\', "takerAddress" character varying NOT NULL, "takeAsset" json NOT NULL DEFAULT \'[]\', "message" text NOT NULL, "start" character varying NOT NULL, "end" character varying NOT NULL, "salt" integer NOT NULL, "acceptedAt" TIMESTAMP WITH TIME ZONE, "rejectedAt" TIMESTAMP WITH TIME ZONE, "rejectedReason" text, "chainId" character varying NOT NULL, CONSTRAINT "PK_fd0ed65ad223d87b7651b8f4bd7" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TABLE "market_swap" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "askId" character varying NOT NULL, "bidId" character varying, "txHash" character varying NOT NULL, "blockNumber" character varying NOT NULL, "private" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_d6fc2d87c047f12ad956393af38" PRIMARY KEY ("id"))')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "market_swap"')
    await queryRunner.query('DROP TABLE "market_bid"')
    await queryRunner.query('DROP TABLE "market_ask"')
    await queryRunner.query('DROP TYPE "public"."market_ask_auctiontype_enum"')
  }

}
