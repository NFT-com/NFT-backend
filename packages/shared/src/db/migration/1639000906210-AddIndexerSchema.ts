import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddIndexerSchema1639000906210 implements MigrationInterface {

  name = 'AddIndexerSchema1639000906210'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "contract_info" ("id" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "network" character varying NOT NULL, "contract" character varying NOT NULL, "bool721" boolean, "bool1155" boolean, "contractName" character varying, "abi" character varying, "proxy" boolean, "implementation" character varying, "implementationAbi" character varying, "implementationName" character varying, CONSTRAINT "PK_de5fc90e42a90a8a9d5233e3f2e" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_2f0289eaf426ffeda831b79d19" ON "contract_info" ("network", "contract", "bool721", "bool1155") ')
    await queryRunner.query('CREATE TABLE "nft_raw" ("id" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "network" character varying NOT NULL, "contract" character varying NOT NULL, "type" "public"."nft_raw_type_enum" NOT NULL, "tokenId" integer, "error" boolean, "errorReason" character varying, "metadataURL" character varying, "metadata" json, CONSTRAINT "PK_c919dca8041e161fe10f7f4544f" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_ff5df98e4083a466fdcb833c4f" ON "nft_raw" ("network", "contract", "tokenId") ')
    await queryRunner.query('CREATE INDEX "IDX_01458ba73b948ff34d8f46660f" ON "nft_raw" ("network", "contract") ')
    await queryRunner.query('CREATE TABLE "nft_trade" ("id" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "network" character varying NOT NULL, "contract" character varying NOT NULL, "transactionHash" character varying NOT NULL, "from" character varying NOT NULL, "to" character varying NOT NULL, "tokenId" integer NOT NULL, "contractExecution" character varying, "blockNumber" integer, "unixTimestamp" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_8ecaa912a490c7ed720849a3f5a" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_3644f634eb18211564971ebb8c" ON "nft_trade" ("network", "contract", "tokenId", "transactionHash") ')
    await queryRunner.query('CREATE INDEX "IDX_be4ac2e411005ab0c9f719f5a1" ON "nft_trade" ("network", "contract") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_be4ac2e411005ab0c9f719f5a1"')
    await queryRunner.query('DROP INDEX "public"."IDX_3644f634eb18211564971ebb8c"')
    await queryRunner.query('DROP TABLE "nft_trade"')
    await queryRunner.query('DROP INDEX "public"."IDX_01458ba73b948ff34d8f46660f"')
    await queryRunner.query('DROP INDEX "public"."IDX_ff5df98e4083a466fdcb833c4f"')
    await queryRunner.query('DROP TABLE "nft_raw"')
    await queryRunner.query('DROP INDEX "public"."IDX_2f0289eaf426ffeda831b79d19"')
    await queryRunner.query('DROP TABLE "contract_info"')
  }

}
