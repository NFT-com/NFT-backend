import { MigrationInterface, QueryRunner } from 'typeorm'

export class RENAMECOLLECTIONTOCURATION1643850328275 implements MigrationInterface {

  name = 'RENAMECOLLECTIONTOCURATION1643850328275'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_4c27707fc3097cd748073acb32"')
    await queryRunner.query('DROP INDEX "public"."IDX_a4db743307da136f0a33734301"')
    await queryRunner.query('ALTER TYPE "public"."edge_thisentitytype_enum" RENAME TO "edge_thisentitytype_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."edge_thisentitytype_enum" AS ENUM(\'Approval\', \'Bid\', \'Curation\', \'Edge\', \'NFT\', \'Profile\', \'User\', \'Wallet\')')
    await queryRunner.query('ALTER TABLE "edge" ALTER COLUMN "thisEntityType" TYPE "public"."edge_thisentitytype_enum" USING "thisEntityType"::"text"::"public"."edge_thisentitytype_enum"')
    await queryRunner.query('DROP TYPE "public"."edge_thisentitytype_enum_old"')
    await queryRunner.query('ALTER TYPE "public"."edge_thatentitytype_enum" RENAME TO "edge_thatentitytype_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."edge_thatentitytype_enum" AS ENUM(\'Approval\', \'Bid\', \'Curation\', \'Edge\', \'NFT\', \'Profile\', \'User\', \'Wallet\')')
    await queryRunner.query('ALTER TABLE "edge" ALTER COLUMN "thatEntityType" TYPE "public"."edge_thatentitytype_enum" USING "thatEntityType"::"text"::"public"."edge_thatentitytype_enum"')
    await queryRunner.query('DROP TYPE "public"."edge_thatentitytype_enum_old"')
    await queryRunner.query('CREATE INDEX "IDX_4c27707fc3097cd748073acb32" ON "edge" ("collectionId", "edgeType", "thatEntityType", "thatEntityId", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_a4db743307da136f0a33734301" ON "edge" ("collectionId", "edgeType", "thatEntityType", "deletedAt") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_a4db743307da136f0a33734301"')
    await queryRunner.query('DROP INDEX "public"."IDX_4c27707fc3097cd748073acb32"')
    await queryRunner.query('CREATE TYPE "public"."edge_thatentitytype_enum_old" AS ENUM(\'Approval\', \'Bid\', \'Collection\', \'Edge\', \'NFT\', \'Profile\', \'User\', \'Wallet\')')
    await queryRunner.query('ALTER TABLE "edge" ALTER COLUMN "thatEntityType" TYPE "public"."edge_thatentitytype_enum_old" USING "thatEntityType"::"text"::"public"."edge_thatentitytype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."edge_thatentitytype_enum"')
    await queryRunner.query('ALTER TYPE "public"."edge_thatentitytype_enum_old" RENAME TO "edge_thatentitytype_enum"')
    await queryRunner.query('CREATE TYPE "public"."edge_thisentitytype_enum_old" AS ENUM(\'Approval\', \'Bid\', \'Collection\', \'Edge\', \'NFT\', \'Profile\', \'User\', \'Wallet\')')
    await queryRunner.query('ALTER TABLE "edge" ALTER COLUMN "thisEntityType" TYPE "public"."edge_thisentitytype_enum_old" USING "thisEntityType"::"text"::"public"."edge_thisentitytype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."edge_thisentitytype_enum"')
    await queryRunner.query('ALTER TYPE "public"."edge_thisentitytype_enum_old" RENAME TO "edge_thisentitytype_enum"')
    await queryRunner.query('CREATE INDEX "IDX_a4db743307da136f0a33734301" ON "edge" ("collectionId", "thatEntityType", "edgeType", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_4c27707fc3097cd748073acb32" ON "edge" ("collectionId", "thatEntityId", "thatEntityType", "edgeType", "deletedAt") ')
  }

}
