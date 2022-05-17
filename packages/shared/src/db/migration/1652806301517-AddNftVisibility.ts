import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddNftVisibility1652806301517 implements MigrationInterface {

  name = 'AddNftVisibility1652806301517'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" RENAME COLUMN "showGallery" TO "nftsLastUpdated"')
    await queryRunner.query('ALTER TABLE "nft" ADD "visibility" boolean DEFAULT false')
    await queryRunner.query('ALTER TYPE "public"."bid_nfttype_enum" RENAME TO "bid_nfttype_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."bid_nfttype_enum" AS ENUM(\'ERC721\', \'ERC1155\', \'UNKNOWN\', \'Profile\', \'GenesisKey\', \'GenesisKeyProfile\')')
    await queryRunner.query('ALTER TABLE "bid" ALTER COLUMN "nftType" TYPE "public"."bid_nfttype_enum" USING "nftType"::"text"::"public"."bid_nfttype_enum"')
    await queryRunner.query('DROP TYPE "public"."bid_nfttype_enum_old"')
    await queryRunner.query('DROP INDEX "public"."IDX_91fa6acf35b7416b33a5ed0b4a"')
    await queryRunner.query('ALTER TYPE "public"."nft_type_enum" RENAME TO "nft_type_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."nft_type_enum" AS ENUM(\'ERC721\', \'ERC1155\', \'UNKNOWN\', \'Profile\', \'GenesisKey\', \'GenesisKeyProfile\')')
    await queryRunner.query('ALTER TABLE "nft" ALTER COLUMN "type" TYPE "public"."nft_type_enum" USING "type"::"text"::"public"."nft_type_enum"')
    await queryRunner.query('DROP TYPE "public"."nft_type_enum_old"')
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "nftsLastUpdated"')
    await queryRunner.query('ALTER TABLE "profile" ADD "nftsLastUpdated" TIMESTAMP WITH TIME ZONE')
    await queryRunner.query('CREATE INDEX "IDX_91fa6acf35b7416b33a5ed0b4a" ON "nft" ("type", "deletedAt", "createdAt", "profileId") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_91fa6acf35b7416b33a5ed0b4a"')
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "nftsLastUpdated"')
    await queryRunner.query('ALTER TABLE "profile" ADD "nftsLastUpdated" boolean')
    await queryRunner.query('CREATE TYPE "public"."nft_type_enum_old" AS ENUM(\'ERC721\', \'ERC1155\', \'Profile\', \'GenesisKey\', \'GenesisKeyProfile\')')
    await queryRunner.query('ALTER TABLE "nft" ALTER COLUMN "type" TYPE "public"."nft_type_enum_old" USING "type"::"text"::"public"."nft_type_enum_old"')
    await queryRunner.query('DROP TYPE "public"."nft_type_enum"')
    await queryRunner.query('ALTER TYPE "public"."nft_type_enum_old" RENAME TO "nft_type_enum"')
    await queryRunner.query('CREATE INDEX "IDX_91fa6acf35b7416b33a5ed0b4a" ON "nft" ("createdAt", "deletedAt", "profileId", "type") ')
    await queryRunner.query('CREATE TYPE "public"."bid_nfttype_enum_old" AS ENUM(\'ERC721\', \'ERC1155\', \'Profile\', \'GenesisKey\', \'GenesisKeyProfile\')')
    await queryRunner.query('ALTER TABLE "bid" ALTER COLUMN "nftType" TYPE "public"."bid_nfttype_enum_old" USING "nftType"::"text"::"public"."bid_nfttype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."bid_nfttype_enum"')
    await queryRunner.query('ALTER TYPE "public"."bid_nfttype_enum_old" RENAME TO "bid_nfttype_enum"')
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "visibility"')
    await queryRunner.query('ALTER TABLE "profile" RENAME COLUMN "nftsLastUpdated" TO "showGallery"')
  }

}
