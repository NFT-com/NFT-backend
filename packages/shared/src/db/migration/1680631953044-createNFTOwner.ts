import { MigrationInterface, QueryRunner } from "typeorm";

export class createNFTOwner1680631953044 implements MigrationInterface {
    name = 'createNFTOwner1680631953044'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "nft_owner" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "balance" integer NOT NULL, "nftId" character varying, "walletId" character varying, CONSTRAINT "PK_83cfd3a290ed70c660f8c9dfe2c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "nft_owner" ADD CONSTRAINT "FK_36f9f24688ad42098d49e51efd5" FOREIGN KEY ("nftId") REFERENCES "nft"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "nft_owner" ADD CONSTRAINT "FK_c5c05f85c61f23bfe81f92cbc1a" FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "nft_owner" DROP CONSTRAINT "FK_c5c05f85c61f23bfe81f92cbc1a"`);
        await queryRunner.query(`ALTER TABLE "nft_owner" DROP CONSTRAINT "FK_36f9f24688ad42098d49e51efd5"`);
        await queryRunner.query(`DROP TABLE "nft_owner"`);
    }

}
