import { MigrationInterface, QueryRunner } from "typeorm";

export class createView1679498649846 implements MigrationInterface {
    name = 'createView1679498649846'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."view_viewedtype_enum" AS ENUM('Collection', 'NFT', 'Profile')`);
        await queryRunner.query(`CREATE TABLE "view" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "viewerId" character varying NOT NULL, "viewedId" character varying NOT NULL, "viewedType" "public"."view_viewedtype_enum" NOT NULL, CONSTRAINT "PK_86cfb9e426c77d60b900fe2b543" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "view"`);
        await queryRunner.query(`DROP TYPE "public"."view_viewedtype_enum"`);
    }

}
