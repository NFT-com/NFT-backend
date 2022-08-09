import { MigrationInterface, QueryRunner } from 'typeorm'

export class createTxTablesModified1660044924863 implements MigrationInterface {

  name = 'createTxTablesModified1660044924863'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."tx_cancel_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TYPE "public"."tx_cancel_foreigntype_enum" AS ENUM(\'Listing\', \'Bid\')')
    await queryRunner.query('CREATE TABLE "tx_cancel" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "exchange" "public"."tx_cancel_exchange_enum" NOT NULL, "foreignType" "public"."tx_cancel_foreigntype_enum", "foreignKeyId" character varying NOT NULL, "transactionHash" character varying NOT NULL, "chainId" character varying, "activityId" character varying NOT NULL, CONSTRAINT "REL_c0536d84fa1a459f2fd721f795" UNIQUE ("activityId"), CONSTRAINT "PK_a35fb271e6009eea9c3b84b9934" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."tx_order_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TYPE "public"."tx_order_ordertype_enum" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('CREATE TYPE "public"."tx_order_protocol_enum" AS ENUM(\'Wyvern\', \'Seaport\', \'LooksRare\')')
    await queryRunner.query('CREATE TABLE "tx_order" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "orderHash" character varying NOT NULL, "exchange" "public"."tx_order_exchange_enum" NOT NULL, "makerAddress" character varying NOT NULL, "takerAddress" character varying, "orderType" "public"."tx_order_ordertype_enum" NOT NULL, "protocol" "public"."tx_order_protocol_enum" NOT NULL, "protocolData" json NOT NULL, "chainId" character varying, "activityId" character varying NOT NULL, CONSTRAINT "UQ_ab7ebf4e776541aadf20eacad69" UNIQUE ("orderHash"), CONSTRAINT "REL_7b92bab8a75d0b8d9056826d00" UNIQUE ("activityId"), CONSTRAINT "PK_a3a5d513d804ee2aea8d3642ef3" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_transactiontype_enum" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_currency_enum" AS ENUM(\'ETH\', \'WETH\', \'USDC\', \'DAI\')')
    await queryRunner.query('CREATE TABLE "tx_transaction" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "exchange" "public"."tx_transaction_exchange_enum" NOT NULL, "transactionType" "public"."tx_transaction_transactiontype_enum" NOT NULL, "price" character varying NOT NULL, "currency" "public"."tx_transaction_currency_enum" NOT NULL, "transactionHash" character varying NOT NULL, "blockNumber" character varying NOT NULL, "nftContractAddress" character varying NOT NULL, "nftContractTokenId" character varying NOT NULL, "sender" character varying NOT NULL, "receiver" character varying NOT NULL, "chainId" character varying, "activityId" character varying NOT NULL, CONSTRAINT "REL_3974a8fbf5b82a6aa936fc3c5b" UNIQUE ("activityId"), CONSTRAINT "PK_0ae54dbd7e22706c6b2c3eb5a6d" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."tx_activity_activitytype_enum" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('CREATE TABLE "tx_activity" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "activityType" "public"."tx_activity_activitytype_enum" NOT NULL, "activityTypeId" character varying NOT NULL, "read" boolean NOT NULL DEFAULT false, "timestamp" TIMESTAMP NOT NULL, "walletId" character varying NOT NULL, "chainId" character varying, CONSTRAINT "UQ_0593116e34265d5000176eaa185" UNIQUE ("activityTypeId"), CONSTRAINT "PK_6e367e6e0098602877808f4e516" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE INDEX "IDX_a4ef34e6c04bb75a6fb5be1600" ON "tx_activity" ("walletId", "timestamp") ')
    await queryRunner.query('ALTER TABLE "event" DROP COLUMN "hideIgnored"')
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "profileId"')
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "associatedContract"')
    await queryRunner.query('ALTER TABLE "wallet" DROP COLUMN "profileId"')
    await queryRunner.query('ALTER TABLE "tx_cancel" ADD CONSTRAINT "FK_c0536d84fa1a459f2fd721f795b" FOREIGN KEY ("activityId") REFERENCES "tx_activity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
    await queryRunner.query('ALTER TABLE "tx_order" ADD CONSTRAINT "FK_7b92bab8a75d0b8d9056826d009" FOREIGN KEY ("activityId") REFERENCES "tx_activity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
    await queryRunner.query('ALTER TABLE "tx_transaction" ADD CONSTRAINT "FK_3974a8fbf5b82a6aa936fc3c5b5" FOREIGN KEY ("activityId") REFERENCES "tx_activity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_transaction" DROP CONSTRAINT "FK_3974a8fbf5b82a6aa936fc3c5b5"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP CONSTRAINT "FK_7b92bab8a75d0b8d9056826d009"')
    await queryRunner.query('ALTER TABLE "tx_cancel" DROP CONSTRAINT "FK_c0536d84fa1a459f2fd721f795b"')
    await queryRunner.query('ALTER TABLE "wallet" ADD "profileId" character varying')
    await queryRunner.query('ALTER TABLE "profile" ADD "associatedContract" character varying')
    await queryRunner.query('ALTER TABLE "nft" ADD "profileId" character varying')
    await queryRunner.query('ALTER TABLE "event" ADD "hideIgnored" boolean NOT NULL DEFAULT false')
    await queryRunner.query('DROP INDEX "public"."IDX_a4ef34e6c04bb75a6fb5be1600"')
    await queryRunner.query('DROP TABLE "tx_activity"')
    await queryRunner.query('DROP TYPE "public"."tx_activity_activitytype_enum"')
    await queryRunner.query('DROP TABLE "tx_transaction"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_currency_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_transactiontype_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_exchange_enum"')
    await queryRunner.query('DROP TABLE "tx_order"')
    await queryRunner.query('DROP TYPE "public"."tx_order_protocol_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_order_ordertype_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_order_exchange_enum"')
    await queryRunner.query('DROP TABLE "tx_cancel"')
    await queryRunner.query('DROP TYPE "public"."tx_cancel_foreigntype_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_cancel_exchange_enum"')
  }

}
