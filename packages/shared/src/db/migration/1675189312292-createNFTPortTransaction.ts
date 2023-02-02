import { MigrationInterface, QueryRunner } from 'typeorm'

export class createNFTPortTransaction1675189312292 implements MigrationInterface {

  name = 'createNFTPortTransaction1675189312292'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."nft_port_transaction_marketplace_enum" AS ENUM(\'OpenSea\', \'LooksRare\', \'X2Y2\', \'Rarible\', \'Cryptopunks\')')
    await queryRunner.query('CREATE TABLE "nft_port_transaction" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "type" character varying NOT NULL, "listerAddress" character varying, "ownerAddress" character varying, "contractAddress" character varying, "tokenId" character varying, "quantity" integer, "transactionHash" character varying, "blockHash" character varying, "blockNumber" character varying, "transferFrom" character varying, "transferTo" character varying, "buyerAddress" character varying, "sellerAddress" character varying, "marketplace" "public"."nft_port_transaction_marketplace_enum", "bidderAddress" character varying, "nft" json, "priceDetails" json, "transactionDate" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_efe504ccc988cad50de68d5eb0b" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE INDEX "IDX_c5d6af0cd54a28803bdd54cf2c" ON "nft_port_transaction" ("marketplace") ')
    await queryRunner.query('CREATE INDEX "IDX_09d2edc45215dc51592fe4db14" ON "nft_port_transaction" ("type", "transactionDate", "contractAddress") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_09d2edc45215dc51592fe4db14"')
    await queryRunner.query('DROP INDEX "public"."IDX_c5d6af0cd54a28803bdd54cf2c"')
    await queryRunner.query('DROP TABLE "nft_port_transaction"')
    await queryRunner.query('DROP TYPE "public"."nft_port_transaction_marketplace_enum"')
  }

}
