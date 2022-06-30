import { MigrationInterface, QueryRunner } from 'typeorm'

export class createTxTables1656606209303 implements MigrationInterface {

  name = 'createTxTables1656606209303'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."tx_bid_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TABLE "tx_bid" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "exchange" "public"."tx_bid_exchange_enum" NOT NULL, CONSTRAINT "PK_03d1588fe81da5ebac29924a68a" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."tx_cancel_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TYPE "public"."tx_cancel_foreigntype_enum" AS ENUM(\'Listing\', \'Sale\')')
    await queryRunner.query('CREATE TABLE "tx_cancel" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "exchange" "public"."tx_cancel_exchange_enum" NOT NULL, "foreignType" "public"."tx_cancel_foreigntype_enum", "foreignKeyId" character varying NOT NULL, "transactionHash" character varying NOT NULL, CONSTRAINT "PK_a35fb271e6009eea9c3b84b9934" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."tx_list_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TABLE "tx_list" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "exchange" "public"."tx_list_exchange_enum" NOT NULL, CONSTRAINT "PK_626af936cae7ce4d0445afd6839" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."tx_sale_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TYPE "public"."tx_sale_currency_enum" AS ENUM(\'ETH\', \'WETH\', \'USDC\', \'DAI\')')
    await queryRunner.query('CREATE TABLE "tx_sale" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "transactionHash" character varying NOT NULL, "blockNumber" character varying NOT NULL, "nftContractAddress" character varying NOT NULL, "nftContractTokenId" character varying NOT NULL, "sender" character varying NOT NULL, "receiver" character varying NOT NULL, "exchange" "public"."tx_sale_exchange_enum" NOT NULL, "price" character varying NOT NULL, "currency" "public"."tx_sale_currency_enum" NOT NULL, CONSTRAINT "PK_bd1388aae6adf6a1352da865da8" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TABLE "tx_transfer" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "transactionHash" character varying NOT NULL, "blockNumber" character varying NOT NULL, "nftContractAddress" character varying NOT NULL, "nftContractTokenId" character varying NOT NULL, "sender" character varying NOT NULL, "receiver" character varying NOT NULL, CONSTRAINT "PK_e38ffe55ceaa7eb747a839fca95" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."tx_activity_foreigntype_enum" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('CREATE TABLE "tx_activity" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "foreignType" "public"."tx_activity_foreigntype_enum" NOT NULL, "read" boolean NOT NULL DEFAULT false, "timestamp" TIMESTAMP NOT NULL, "userId" character varying NOT NULL, "bidId" character varying, "cancelId" character varying, "listingId" character varying, "saleId" character varying, "transferId" character varying, CONSTRAINT "REL_2fe5e3280f9dcb6f6b232da55b" UNIQUE ("bidId"), CONSTRAINT "REL_63c73ddf440af4711e8555ffe4" UNIQUE ("cancelId"), CONSTRAINT "REL_8f2f71a738f735e6bfda64b929" UNIQUE ("listingId"), CONSTRAINT "REL_2c740dc95a9468a5969749ba73" UNIQUE ("saleId"), CONSTRAINT "REL_8bf87550ba42d1949a1bbd3b4f" UNIQUE ("transferId"), CONSTRAINT "PK_6e367e6e0098602877808f4e516" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_df3e78c2db8c8937a06b521c9a" ON "tx_activity" ("userId", "timestamp") ')
    await queryRunner.query('ALTER TABLE "tx_activity" ADD CONSTRAINT "FK_2fe5e3280f9dcb6f6b232da55bd" FOREIGN KEY ("bidId") REFERENCES "tx_bid"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
    await queryRunner.query('ALTER TABLE "tx_activity" ADD CONSTRAINT "FK_63c73ddf440af4711e8555ffe4e" FOREIGN KEY ("cancelId") REFERENCES "tx_cancel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
    await queryRunner.query('ALTER TABLE "tx_activity" ADD CONSTRAINT "FK_8f2f71a738f735e6bfda64b9299" FOREIGN KEY ("listingId") REFERENCES "tx_list"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
    await queryRunner.query('ALTER TABLE "tx_activity" ADD CONSTRAINT "FK_2c740dc95a9468a5969749ba734" FOREIGN KEY ("saleId") REFERENCES "tx_sale"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
    await queryRunner.query('ALTER TABLE "tx_activity" ADD CONSTRAINT "FK_8bf87550ba42d1949a1bbd3b4fd" FOREIGN KEY ("transferId") REFERENCES "tx_transfer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_activity" DROP CONSTRAINT "FK_8bf87550ba42d1949a1bbd3b4fd"')
    await queryRunner.query('ALTER TABLE "tx_activity" DROP CONSTRAINT "FK_2c740dc95a9468a5969749ba734"')
    await queryRunner.query('ALTER TABLE "tx_activity" DROP CONSTRAINT "FK_8f2f71a738f735e6bfda64b9299"')
    await queryRunner.query('ALTER TABLE "tx_activity" DROP CONSTRAINT "FK_63c73ddf440af4711e8555ffe4e"')
    await queryRunner.query('ALTER TABLE "tx_activity" DROP CONSTRAINT "FK_2fe5e3280f9dcb6f6b232da55bd"')
    await queryRunner.query('DROP INDEX "public"."IDX_df3e78c2db8c8937a06b521c9a"')
    await queryRunner.query('DROP TABLE "tx_activity"')
    await queryRunner.query('DROP TYPE "public"."tx_activity_foreigntype_enum"')
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
