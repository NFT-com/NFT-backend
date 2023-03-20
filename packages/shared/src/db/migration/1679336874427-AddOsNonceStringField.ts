import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOsNonceStringField1679336874427 implements MigrationInterface {
    name = 'AddOsNonceStringField1679336874427'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_nft_port_transaction_nft"`);
        await queryRunner.query(`DROP INDEX "public"."idx_tx_activity_nftid"`);
        await queryRunner.query(`CREATE TYPE "public"."like_likedtype_enum" AS ENUM('Collection', 'NFT', 'Profile')`);
        await queryRunner.query(`CREATE TABLE "like" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "likedById" character varying NOT NULL, "likedId" character varying NOT NULL, "likedType" "public"."like_likedtype_enum" NOT NULL, CONSTRAINT "UQ_0ba3e4c695fbf88dd2501c4b1aa" UNIQUE ("likedById", "likedId", "likedType"), CONSTRAINT "PK_eff3e46d24d416b52a7e0ae4159" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0ba3e4c695fbf88dd2501c4b1a" ON "like" ("likedById", "likedId", "likedType") `);
        await queryRunner.query(`ALTER TABLE "tx_order" ADD "osNonce" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tx_order" DROP COLUMN "osNonce"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0ba3e4c695fbf88dd2501c4b1a"`);
        await queryRunner.query(`DROP TABLE "like"`);
        await queryRunner.query(`DROP TYPE "public"."like_likedtype_enum"`);
        await queryRunner.query(`CREATE INDEX "idx_tx_activity_nftid" ON "tx_activity" ("nftId") `);
        await queryRunner.query(`CREATE INDEX "idx_nft_port_transaction_nft" ON "nft_port_transaction" ("nft") `);
    }

}
