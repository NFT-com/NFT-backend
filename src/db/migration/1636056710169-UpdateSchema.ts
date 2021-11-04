/* eslint-disable max-len */
import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateSchema1636056710169 implements MigrationInterface {

  name = 'UpdateSchema1636056710169'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."profile_status_enum" AS ENUM(\'Available\', \'Owned\', \'Pending\')')
    await queryRunner.query('ALTER TABLE "profile" ADD "status" "public"."profile_status_enum" NOT NULL DEFAULT \'Available\'')
    await queryRunner.query('ALTER TABLE "profile" ADD "bannerURL" character varying')
    await queryRunner.query('ALTER TABLE "user" ADD "referralId" character varying NOT NULL')
    await queryRunner.query('DROP INDEX "public"."IDX_6d05b97f6bd418e7349581ce79"')
    await queryRunner.query('DROP INDEX "public"."IDX_0782d1067dcf4c7496e49a8142"')
    await queryRunner.query('DROP INDEX "public"."IDX_cff1a3063eecfa8690eb323b7d"')
    await queryRunner.query('DROP INDEX "public"."IDX_a4db743307da136f0a33734301"')
    await queryRunner.query('DROP INDEX "public"."IDX_3447756fead163cc28da29f50b"')
    await queryRunner.query('DROP INDEX "public"."IDX_05675ffabd0e7411d60f1c8a3f"')
    await queryRunner.query('DROP INDEX "public"."IDX_4c27707fc3097cd748073acb32"')
    await queryRunner.query('ALTER TYPE "public"."edge_edgetype_enum" RENAME TO "edge_edgetype_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."edge_edgetype_enum" AS ENUM(\'Follows\', \'Referred\')')
    await queryRunner.query('ALTER TABLE "edge" ALTER COLUMN "edgeType" TYPE "public"."edge_edgetype_enum" USING "edgeType"::"text"::"public"."edge_edgetype_enum"')
    await queryRunner.query('DROP TYPE "public"."edge_edgetype_enum_old"')
    await queryRunner.query('ALTER TABLE "profile" ALTER COLUMN "ownerUserId" DROP NOT NULL')
    await queryRunner.query('ALTER TABLE "profile" ALTER COLUMN "ownerWalletId" DROP NOT NULL')
    await queryRunner.query('ALTER TABLE "user" DROP CONSTRAINT "UQ_4007f003f9899ca1c146097eff9"')
    await queryRunner.query('ALTER TABLE "user" DROP COLUMN "confirmEmailToken"')
    await queryRunner.query('ALTER TABLE "user" ADD "confirmEmailToken" character varying')
    await queryRunner.query('ALTER TABLE "user" ADD CONSTRAINT "UQ_4007f003f9899ca1c146097eff9" UNIQUE ("confirmEmailToken")')
    await queryRunner.query('CREATE INDEX "IDX_6d05b97f6bd418e7349581ce79" ON "edge" ("thisEntityId", "thatEntityId", "edgeType", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_0782d1067dcf4c7496e49a8142" ON "edge" ("thatEntityId", "edgeType", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE INDEX "IDX_cff1a3063eecfa8690eb323b7d" ON "edge" ("thisEntityId", "edgeType", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE INDEX "IDX_4c27707fc3097cd748073acb32" ON "edge" ("collectionId", "edgeType", "thatEntityType", "thatEntityId", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_a4db743307da136f0a33734301" ON "edge" ("collectionId", "edgeType", "thatEntityType", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_3447756fead163cc28da29f50b" ON "edge" ("collectionId", "edgeType", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_05675ffabd0e7411d60f1c8a3f" ON "edge" ("collectionId", "edgeType", "thatEntityId", "thisEntityId") ')
    await queryRunner.query('CREATE INDEX "IDX_ab57b9b261d32985dab1918438" ON "user" ("referralId") ')
    await queryRunner.query('CREATE INDEX "IDX_a05a906b15d53a789c5fc86d69" ON "user" ("confirmEmailToken", "confirmEmailTokenExpiresAt") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_a05a906b15d53a789c5fc86d69"')
    await queryRunner.query('DROP INDEX "public"."IDX_ab57b9b261d32985dab1918438"')
    await queryRunner.query('DROP INDEX "public"."IDX_05675ffabd0e7411d60f1c8a3f"')
    await queryRunner.query('DROP INDEX "public"."IDX_3447756fead163cc28da29f50b"')
    await queryRunner.query('DROP INDEX "public"."IDX_a4db743307da136f0a33734301"')
    await queryRunner.query('DROP INDEX "public"."IDX_4c27707fc3097cd748073acb32"')
    await queryRunner.query('DROP INDEX "public"."IDX_cff1a3063eecfa8690eb323b7d"')
    await queryRunner.query('DROP INDEX "public"."IDX_0782d1067dcf4c7496e49a8142"')
    await queryRunner.query('DROP INDEX "public"."IDX_6d05b97f6bd418e7349581ce79"')
    await queryRunner.query('ALTER TABLE "user" DROP CONSTRAINT "UQ_4007f003f9899ca1c146097eff9"')
    await queryRunner.query('ALTER TABLE "user" DROP COLUMN "confirmEmailToken"')
    await queryRunner.query('ALTER TABLE "user" ADD "confirmEmailToken" integer')
    await queryRunner.query('ALTER TABLE "user" ADD CONSTRAINT "UQ_4007f003f9899ca1c146097eff9" UNIQUE ("confirmEmailToken")')
    await queryRunner.query('ALTER TABLE "profile" ALTER COLUMN "ownerWalletId" SET NOT NULL')
    await queryRunner.query('ALTER TABLE "profile" ALTER COLUMN "ownerUserId" SET NOT NULL')
    await queryRunner.query('CREATE TYPE "public"."edge_edgetype_enum_old" AS ENUM(\'Follows\')')
    await queryRunner.query('ALTER TABLE "edge" ALTER COLUMN "edgeType" TYPE "public"."edge_edgetype_enum_old" USING "edgeType"::"text"::"public"."edge_edgetype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."edge_edgetype_enum"')
    await queryRunner.query('ALTER TYPE "public"."edge_edgetype_enum_old" RENAME TO "edge_edgetype_enum"')
    await queryRunner.query('CREATE INDEX "IDX_4c27707fc3097cd748073acb32" ON "edge" ("deletedAt", "collectionId", "thatEntityId", "thatEntityType", "edgeType") ')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_05675ffabd0e7411d60f1c8a3f" ON "edge" ("collectionId", "thisEntityId", "thatEntityId", "edgeType") ')
    await queryRunner.query('CREATE INDEX "IDX_3447756fead163cc28da29f50b" ON "edge" ("createdAt", "deletedAt", "collectionId", "edgeType") ')
    await queryRunner.query('CREATE INDEX "IDX_a4db743307da136f0a33734301" ON "edge" ("deletedAt", "collectionId", "thatEntityType", "edgeType") ')
    await queryRunner.query('CREATE INDEX "IDX_cff1a3063eecfa8690eb323b7d" ON "edge" ("createdAt", "deletedAt", "thisEntityId", "edgeType") ')
    await queryRunner.query('CREATE INDEX "IDX_0782d1067dcf4c7496e49a8142" ON "edge" ("createdAt", "deletedAt", "thatEntityId", "edgeType") ')
    await queryRunner.query('CREATE INDEX "IDX_6d05b97f6bd418e7349581ce79" ON "edge" ("deletedAt", "thisEntityId", "thatEntityId", "edgeType") ')
    await queryRunner.query('ALTER TABLE "user" DROP COLUMN "referralId"')
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "bannerURL"')
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "status"')
    await queryRunner.query('DROP TYPE "public"."profile_status_enum"')
  }

}
