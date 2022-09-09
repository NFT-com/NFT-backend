import { MigrationInterface, QueryRunner } from 'typeorm'

export class createMarketplaceSale1662742034526 implements MigrationInterface {

  name = 'createMarketplaceSale1662742034526'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "marketplace_sale" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "date" TIMESTAMP NOT NULL, "priceUSD" numeric NOT NULL, "contractAddress" character varying NOT NULL, "tokenId" character varying NOT NULL, "transaction" json NOT NULL, CONSTRAINT "PK_e8c3c047a0f430ffe301dd0130d" PRIMARY KEY ("id"))')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "marketplace_sale"')
  }

}
