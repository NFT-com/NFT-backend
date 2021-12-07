import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddIndexerSchema1638902656340 implements MigrationInterface {

  name = 'AddIndexerSchema1638902656340'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "nft_trade" ("id" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "network" character varying NOT NULL, "contract" character varying NOT NULL, "transactionHash" character varying NOT NULL, "from" character varying NOT NULL, "to" character varying NOT NULL, "tokenId" integer NOT NULL, "contractExecution" character varying, "blockNumber" integer, "unixTimestamp" TIMESTAMP WITH TIME ZONE, "nftRawId" character varying, CONSTRAINT "PK_8ecaa912a490c7ed720849a3f5a" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TABLE "nft_raw" ("id" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "network" character varying NOT NULL, "contract" character varying NOT NULL, "type" "public"."nft_raw_type_enum" NOT NULL, "tokenId" integer, "error" boolean, "errorReason" character varying, "metadataURL" character varying, "metadata" json, CONSTRAINT "PK_c919dca8041e161fe10f7f4544f" PRIMARY KEY ("id"))')
    await queryRunner.query('ALTER TABLE "nft_trade" ADD CONSTRAINT "FK_d7e83c18c5cd8b9f5e0b22c2b0f" FOREIGN KEY ("nftRawId") REFERENCES "nft_raw"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft_trade" DROP CONSTRAINT "FK_d7e83c18c5cd8b9f5e0b22c2b0f"')
    await queryRunner.query('DROP TABLE "nft_raw"')
    await queryRunner.query('DROP TABLE "nft_trade"')
  }

}
