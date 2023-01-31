import { MigrationInterface, QueryRunner } from 'typeorm'

export class nftportTransaction1675146753806 implements MigrationInterface {

  name = 'nftportTransaction1675146753806'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "nft_port_transaction_entity" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "type" character varying NOT NULL, "listerAddress" character varying, "ownerAddress" character varying, "contractAddress" character varying, "tokenId" character varying, "quantity" integer, "transactionHash" character varying, "blockHash" character varying, "blockNumber" character varying, "transactionDate" character varying, "transferFrom" character varying, "transferTo" character varying, "buyerAddress" character varying, "sellerAddress" character varying, "marketplace" character varying, "bidderAddress" character varying, "nft" json NOT NULL, "priceDetails" json NOT NULL, "transactionAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_0557959c0909bb8023c1d46ce5a" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE INDEX "IDX_5ba71506e913dc2e866757e0f9" ON "nft_port_transaction_entity" ("type", "transactionAt", "contractAddress") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_5ba71506e913dc2e866757e0f9"')
    await queryRunner.query('DROP TABLE "nft_port_transaction_entity"')
  }

}
