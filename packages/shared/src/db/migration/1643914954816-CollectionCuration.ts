import { MigrationInterface, QueryRunner } from 'typeorm'

export class CollectionCuration1643914954816 implements MigrationInterface {

  name = 'CollectionCuration1643914954816'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_ca25eb01f75a85272300f33602"')
    await queryRunner.query('CREATE TABLE "curation" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "items" json NOT NULL DEFAULT \'[]\', "userId" character varying NOT NULL, CONSTRAINT "PK_de0e4d1c645b4bc2e9a26b9a3f1" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE INDEX "IDX_2d96271c65f68abee85b67a850" ON "curation" ("userId") ')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "items"')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "userId"')
    await queryRunner.query('ALTER TABLE "collection" ADD "contract" character varying NOT NULL')
    await queryRunner.query('ALTER TABLE "collection" ADD "name" character varying')
    await queryRunner.query('DROP INDEX "public"."IDX_a4db743307da136f0a33734301"')
    await queryRunner.query('DROP INDEX "public"."IDX_4c27707fc3097cd748073acb32"')
    await queryRunner.query('ALTER TYPE "public"."edge_thisentitytype_enum" RENAME TO "edge_thisentitytype_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."edge_thisentitytype_enum" AS ENUM(\'Approval\', \'Bid\', \'Curation\', \'Collection\', \'Edge\', \'NFT\', \'Profile\', \'User\', \'Wallet\')')
    await queryRunner.query('ALTER TABLE "edge" ALTER COLUMN "thisEntityType" TYPE "public"."edge_thisentitytype_enum" USING "thisEntityType"::"text"::"public"."edge_thisentitytype_enum"')
    await queryRunner.query('DROP TYPE "public"."edge_thisentitytype_enum_old"')
    await queryRunner.query('ALTER TYPE "public"."edge_thatentitytype_enum" RENAME TO "edge_thatentitytype_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."edge_thatentitytype_enum" AS ENUM(\'Approval\', \'Bid\', \'Curation\', \'Collection\', \'Edge\', \'NFT\', \'Profile\', \'User\', \'Wallet\')')
    await queryRunner.query('ALTER TABLE "edge" ALTER COLUMN "thatEntityType" TYPE "public"."edge_thatentitytype_enum" USING "thatEntityType"::"text"::"public"."edge_thatentitytype_enum"')
    await queryRunner.query('DROP TYPE "public"."edge_thatentitytype_enum_old"')
    await queryRunner.query('CREATE INDEX "IDX_e814aff6539600dfcc88af41fc" ON "collection" ("contract") ')
    await queryRunner.query('CREATE INDEX "IDX_4c27707fc3097cd748073acb32" ON "edge" ("collectionId", "edgeType", "thatEntityType", "thatEntityId", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_a4db743307da136f0a33734301" ON "edge" ("collectionId", "edgeType", "thatEntityType", "deletedAt") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_a4db743307da136f0a33734301"')
    await queryRunner.query('DROP INDEX "public"."IDX_4c27707fc3097cd748073acb32"')
    await queryRunner.query('DROP INDEX "public"."IDX_e814aff6539600dfcc88af41fc"')
    await queryRunner.query('CREATE TYPE "public"."edge_thatentitytype_enum_old" AS ENUM(\'Approval\', \'Bid\', \'Collection\', \'Edge\', \'NFT\', \'Profile\', \'User\', \'Wallet\')')
    await queryRunner.query('ALTER TABLE "edge" ALTER COLUMN "thatEntityType" TYPE "public"."edge_thatentitytype_enum_old" USING "thatEntityType"::"text"::"public"."edge_thatentitytype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."edge_thatentitytype_enum"')
    await queryRunner.query('ALTER TYPE "public"."edge_thatentitytype_enum_old" RENAME TO "edge_thatentitytype_enum"')
    await queryRunner.query('CREATE TYPE "public"."edge_thisentitytype_enum_old" AS ENUM(\'Approval\', \'Bid\', \'Collection\', \'Edge\', \'NFT\', \'Profile\', \'User\', \'Wallet\')')
    await queryRunner.query('ALTER TABLE "edge" ALTER COLUMN "thisEntityType" TYPE "public"."edge_thisentitytype_enum_old" USING "thisEntityType"::"text"::"public"."edge_thisentitytype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."edge_thisentitytype_enum"')
    await queryRunner.query('ALTER TYPE "public"."edge_thisentitytype_enum_old" RENAME TO "edge_thisentitytype_enum"')
    await queryRunner.query('CREATE INDEX "IDX_4c27707fc3097cd748073acb32" ON "edge" ("collectionId", "thatEntityId", "thatEntityType", "edgeType", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_a4db743307da136f0a33734301" ON "edge" ("collectionId", "thatEntityType", "edgeType", "deletedAt") ')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "name"')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "contract"')
    await queryRunner.query('ALTER TABLE "collection" ADD "userId" character varying NOT NULL')
    await queryRunner.query('ALTER TABLE "collection" ADD "items" json NOT NULL DEFAULT \'[]\'')
    await queryRunner.query('DROP INDEX "public"."IDX_2d96271c65f68abee85b67a850"')
    await queryRunner.query('DROP TABLE "curation"')
    await queryRunner.query('CREATE INDEX "IDX_ca25eb01f75a85272300f33602" ON "collection" ("userId") ')
  }

}
