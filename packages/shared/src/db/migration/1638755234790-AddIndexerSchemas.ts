import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddIndexerSchemas1638755234790 implements MigrationInterface {

  name = 'AddIndexerSchemas1638755234790'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "contract_info" ("id" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "network" character varying NOT NULL, "contract" character varying NOT NULL, "bool721" boolean, "bool1155" boolean, "contractName" character varying, "abi" character varying, "proxy" boolean, "implementation" character varying, "implementationAbi" character varying, "implementationName" character varying, CONSTRAINT "PK_de5fc90e42a90a8a9d5233e3f2e" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TABLE "nft_trade" ("id" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "network" character varying NOT NULL, "transactionHash" character varying NOT NULL, "contractExecution" character varying NOT NULL, "unixTimestamp" integer NOT NULL, "nftRawId" character varying, CONSTRAINT "PK_8ecaa912a490c7ed720849a3f5a" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."nft_raw_type_enum" AS ENUM(\'ERC721\', \'ERC1155\', \'Profile\')')
    await queryRunner.query('CREATE TABLE "nft_raw" ("id" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "network" character varying NOT NULL, "contract" character varying NOT NULL, "type" "public"."nft_raw_type_enum" NOT NULL, "tokenId" integer, "metadataURL" character varying NOT NULL, "metadata" json NOT NULL, CONSTRAINT "PK_c919dca8041e161fe10f7f4544f" PRIMARY KEY ("id"))')
    await queryRunner.query('ALTER TABLE "nft_trade" ADD CONSTRAINT "FK_d7e83c18c5cd8b9f5e0b22c2b0f" FOREIGN KEY ("nftRawId") REFERENCES "nft_raw"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft_trade" DROP CONSTRAINT "FK_d7e83c18c5cd8b9f5e0b22c2b0f"')
    await queryRunner.query('DROP TABLE "nft_raw"')
    await queryRunner.query('DROP TYPE "public"."nft_raw_type_enum"')
    await queryRunner.query('DROP TABLE "nft_trade"')
    await queryRunner.query('DROP TABLE "contract_info"')
  }

}
