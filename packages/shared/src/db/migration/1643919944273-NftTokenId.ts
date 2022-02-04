import { MigrationInterface, QueryRunner } from 'typeorm'

export class NftTokenId1643919944273 implements MigrationInterface {

  name = 'NftTokenId1643919944273'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" ADD "tokenId" character varying NOT NULL')
    await queryRunner.query('DROP INDEX "public"."IDX_6d05b97f6bd418e7349581ce79"')
    await queryRunner.query('DROP INDEX "public"."IDX_0782d1067dcf4c7496e49a8142"')
    await queryRunner.query('DROP INDEX "public"."IDX_cff1a3063eecfa8690eb323b7d"')
    await queryRunner.query('DROP INDEX "public"."IDX_3447756fead163cc28da29f50b"')
    await queryRunner.query('DROP INDEX "public"."IDX_6daf260f04aad49c0e164fe8ac"')
    await queryRunner.query('DROP INDEX "public"."IDX_4c27707fc3097cd748073acb32"')
    await queryRunner.query('DROP INDEX "public"."IDX_a4db743307da136f0a33734301"')
    await queryRunner.query('ALTER TYPE "public"."edge_edgetype_enum" RENAME TO "edge_edgetype_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."edge_edgetype_enum" AS ENUM(\'Follows\', \'Referred\', \'Displays\', \'Includes\')')
    await queryRunner.query('ALTER TABLE "edge" ALTER COLUMN "edgeType" TYPE "public"."edge_edgetype_enum" USING "edgeType"::"text"::"public"."edge_edgetype_enum"')
    await queryRunner.query('DROP TYPE "public"."edge_edgetype_enum_old"')
    await queryRunner.query('CREATE INDEX "IDX_6d05b97f6bd418e7349581ce79" ON "edge" ("thisEntityId", "thatEntityId", "edgeType", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_0782d1067dcf4c7496e49a8142" ON "edge" ("thatEntityId", "edgeType", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE INDEX "IDX_cff1a3063eecfa8690eb323b7d" ON "edge" ("thisEntityId", "edgeType", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE INDEX "IDX_4c27707fc3097cd748073acb32" ON "edge" ("collectionId", "edgeType", "thatEntityType", "thatEntityId", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_a4db743307da136f0a33734301" ON "edge" ("collectionId", "edgeType", "thatEntityType", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_3447756fead163cc28da29f50b" ON "edge" ("collectionId", "edgeType", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_6daf260f04aad49c0e164fe8ac" ON "edge" ("collectionId", "edgeType", "thatEntityId", "thisEntityId", "deletedAt") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_6daf260f04aad49c0e164fe8ac"')
    await queryRunner.query('DROP INDEX "public"."IDX_3447756fead163cc28da29f50b"')
    await queryRunner.query('DROP INDEX "public"."IDX_a4db743307da136f0a33734301"')
    await queryRunner.query('DROP INDEX "public"."IDX_4c27707fc3097cd748073acb32"')
    await queryRunner.query('DROP INDEX "public"."IDX_cff1a3063eecfa8690eb323b7d"')
    await queryRunner.query('DROP INDEX "public"."IDX_0782d1067dcf4c7496e49a8142"')
    await queryRunner.query('DROP INDEX "public"."IDX_6d05b97f6bd418e7349581ce79"')
    await queryRunner.query('CREATE TYPE "public"."edge_edgetype_enum_old" AS ENUM(\'Follows\', \'Referred\', \'Displays\')')
    await queryRunner.query('ALTER TABLE "edge" ALTER COLUMN "edgeType" TYPE "public"."edge_edgetype_enum_old" USING "edgeType"::"text"::"public"."edge_edgetype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."edge_edgetype_enum"')
    await queryRunner.query('ALTER TYPE "public"."edge_edgetype_enum_old" RENAME TO "edge_edgetype_enum"')
    await queryRunner.query('CREATE INDEX "IDX_a4db743307da136f0a33734301" ON "edge" ("collectionId", "thatEntityType", "edgeType", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_4c27707fc3097cd748073acb32" ON "edge" ("collectionId", "thatEntityId", "thatEntityType", "edgeType", "deletedAt") ')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_6daf260f04aad49c0e164fe8ac" ON "edge" ("collectionId", "thisEntityId", "thatEntityId", "edgeType", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_3447756fead163cc28da29f50b" ON "edge" ("collectionId", "edgeType", "createdAt", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_cff1a3063eecfa8690eb323b7d" ON "edge" ("thisEntityId", "edgeType", "createdAt", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_0782d1067dcf4c7496e49a8142" ON "edge" ("thatEntityId", "edgeType", "createdAt", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_6d05b97f6bd418e7349581ce79" ON "edge" ("thisEntityId", "thatEntityId", "edgeType", "deletedAt") ')
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "tokenId"')
  }

}
