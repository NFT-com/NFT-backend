import { MigrationInterface, QueryRunner } from "typeorm";

export class createComment1679945371022 implements MigrationInterface {
    name = 'createComment1679945371022'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."comment_entitytype_enum" AS ENUM('Collection', 'NFT', 'Profile')`);
        await queryRunner.query(`CREATE TYPE "public"."comment_status_enum" AS ENUM('Explicit', 'Flagged', 'Hidden', 'Pending Review', 'Published', 'Sensitive')`);
        await queryRunner.query(`CREATE TABLE "comment" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "authorId" character varying NOT NULL, "entityId" character varying NOT NULL, "entityType" "public"."comment_entitytype_enum" NOT NULL, "content" character varying NOT NULL, "status" "public"."comment_status_enum" NOT NULL DEFAULT 'Published', CONSTRAINT "PK_0b0e4bbc8415ec426f87f3a88e2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8b6c5ed2480ae8eadb17c0b899" ON "comment" ("authorId", "entityId", "entityType") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_8b6c5ed2480ae8eadb17c0b899"`);
        await queryRunner.query(`DROP TABLE "comment"`);
        await queryRunner.query(`DROP TYPE "public"."comment_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."comment_entitytype_enum"`);
    }

}
