import { MigrationInterface, QueryRunner } from 'typeorm'

export class createTxTables1657132434617 implements MigrationInterface {

  name = 'createTxTables1657132434617'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."tx_bid_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TABLE "tx_bid" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "exchange" "public"."tx_bid_exchange_enum" NOT NULL, "orderHash" character varying NOT NULL, "makerAddress" character varying NOT NULL, "takerAddress" character varying, "offer" json NOT NULL, "consideration" json NOT NULL, "activityId" character varying NOT NULL, CONSTRAINT "REL_cb9e1eab46dcdac05289e029d9" UNIQUE ("activityId"), CONSTRAINT "PK_03d1588fe81da5ebac29924a68a" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."tx_cancel_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TYPE "public"."tx_cancel_foreigntype_enum" AS ENUM(\'Listing\', \'Bid\')')
    await queryRunner.query('CREATE TABLE "tx_cancel" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "exchange" "public"."tx_cancel_exchange_enum" NOT NULL, "foreignType" "public"."tx_cancel_foreigntype_enum", "foreignKeyId" character varying NOT NULL, "transactionHash" character varying NOT NULL, "activityId" character varying NOT NULL, CONSTRAINT "REL_c0536d84fa1a459f2fd721f795" UNIQUE ("activityId"), CONSTRAINT "PK_a35fb271e6009eea9c3b84b9934" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."tx_list_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TABLE "tx_list" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "exchange" "public"."tx_list_exchange_enum" NOT NULL, "orderHash" character varying NOT NULL, "makerAddress" character varying NOT NULL, "takerAddress" character varying, "offer" json NOT NULL, "consideration" json NOT NULL, "activityId" character varying NOT NULL, CONSTRAINT "REL_2672650ab1887ba1f93ff742d3" UNIQUE ("activityId"), CONSTRAINT "PK_626af936cae7ce4d0445afd6839" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."tx_sale_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TYPE "public"."tx_sale_currency_enum" AS ENUM(\'ETH\', \'WETH\', \'USDC\', \'DAI\')')
    await queryRunner.query('CREATE TABLE "tx_sale" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "exchange" "public"."tx_sale_exchange_enum" NOT NULL, "price" character varying NOT NULL, "currency" "public"."tx_sale_currency_enum" NOT NULL, "transactionHash" character varying NOT NULL, "blockNumber" character varying NOT NULL, "nftContractAddress" character varying NOT NULL, "nftContractTokenId" character varying NOT NULL, "sender" character varying NOT NULL, "receiver" character varying NOT NULL, "activityId" character varying NOT NULL, CONSTRAINT "REL_fd980d0faff7f0fc7f014710ec" UNIQUE ("activityId"), CONSTRAINT "PK_bd1388aae6adf6a1352da865da8" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TABLE "tx_transfer" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "transactionHash" character varying NOT NULL, "blockNumber" character varying NOT NULL, "nftContractAddress" character varying NOT NULL, "nftContractTokenId" character varying NOT NULL, "sender" character varying NOT NULL, "receiver" character varying NOT NULL, "activityId" character varying NOT NULL, CONSTRAINT "REL_19a7ea5b501e4b994e27b81752" UNIQUE ("activityId"), CONSTRAINT "PK_e38ffe55ceaa7eb747a839fca95" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."tx_activity_activitytype_enum" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('CREATE TABLE "tx_activity" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "activityType" "public"."tx_activity_activitytype_enum" NOT NULL, "activityTypeId" character varying NOT NULL, "read" boolean NOT NULL DEFAULT false, "timestamp" TIMESTAMP NOT NULL, "userId" character varying NOT NULL, CONSTRAINT "PK_6e367e6e0098602877808f4e516" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_df3e78c2db8c8937a06b521c9a" ON "tx_activity" ("userId", "timestamp") ')
    await queryRunner.query('ALTER TABLE "tx_bid" ADD CONSTRAINT "FK_cb9e1eab46dcdac05289e029d9b" FOREIGN KEY ("activityId") REFERENCES "tx_activity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
    await queryRunner.query('ALTER TABLE "tx_cancel" ADD CONSTRAINT "FK_c0536d84fa1a459f2fd721f795b" FOREIGN KEY ("activityId") REFERENCES "tx_activity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
    await queryRunner.query('ALTER TABLE "tx_list" ADD CONSTRAINT "FK_2672650ab1887ba1f93ff742d3c" FOREIGN KEY ("activityId") REFERENCES "tx_activity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
    await queryRunner.query('ALTER TABLE "tx_sale" ADD CONSTRAINT "FK_fd980d0faff7f0fc7f014710ec5" FOREIGN KEY ("activityId") REFERENCES "tx_activity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
    await queryRunner.query('ALTER TABLE "tx_transfer" ADD CONSTRAINT "FK_19a7ea5b501e4b994e27b817529" FOREIGN KEY ("activityId") REFERENCES "tx_activity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_transfer" DROP CONSTRAINT "FK_19a7ea5b501e4b994e27b817529"')
    await queryRunner.query('ALTER TABLE "tx_sale" DROP CONSTRAINT "FK_fd980d0faff7f0fc7f014710ec5"')
    await queryRunner.query('ALTER TABLE "tx_list" DROP CONSTRAINT "FK_2672650ab1887ba1f93ff742d3c"')
    await queryRunner.query('ALTER TABLE "tx_cancel" DROP CONSTRAINT "FK_c0536d84fa1a459f2fd721f795b"')
    await queryRunner.query('ALTER TABLE "tx_bid" DROP CONSTRAINT "FK_cb9e1eab46dcdac05289e029d9b"')
    await queryRunner.query('DROP INDEX "public"."IDX_df3e78c2db8c8937a06b521c9a"')
    await queryRunner.query('DROP TABLE "tx_activity"')
    await queryRunner.query('DROP TYPE "public"."tx_activity_activitytype_enum"')
    await queryRunner.query('DROP TABLE "tx_transfer"')
    await queryRunner.query('DROP TABLE "tx_sale"')
    await queryRunner.query('DROP TYPE "public"."tx_sale_currency_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_sale_exchange_enum"')
    await queryRunner.query('DROP TABLE "tx_list"')
    await queryRunner.query('DROP TYPE "public"."tx_list_exchange_enum"')
    await queryRunner.query('DROP TABLE "tx_cancel"')
    await queryRunner.query('DROP TYPE "public"."tx_cancel_foreigntype_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_cancel_exchange_enum"')
    await queryRunner.query('DROP TABLE "tx_bid"')
    await queryRunner.query('DROP TYPE "public"."tx_bid_exchange_enum"')
  }

}
