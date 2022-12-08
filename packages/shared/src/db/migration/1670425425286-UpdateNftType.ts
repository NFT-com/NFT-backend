import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateNftType1670425425286 implements MigrationInterface {

  name = 'UpdateNftType1670425425286'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "public"."bid_nfttype_enum" RENAME TO "bid_nfttype_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."bid_nfttype_enum" AS ENUM(\'ERC721\', \'ERC1155\', \'UNKNOWN\', \'CRYPTO_PUNKS\', \'Profile\', \'GenesisKey\', \'GenesisKeyProfile\')')
    await queryRunner.query('ALTER TABLE "bid" ALTER COLUMN "nftType" TYPE "public"."bid_nfttype_enum" USING "nftType"::"text"::"public"."bid_nfttype_enum"')
    await queryRunner.query('DROP TYPE "public"."bid_nfttype_enum_old"')
    await queryRunner.query('DROP INDEX "public"."IDX_574758e1075217237450afe514"')
    await queryRunner.query('ALTER TYPE "public"."nft_type_enum" RENAME TO "nft_type_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."nft_type_enum" AS ENUM(\'ERC721\', \'ERC1155\', \'UNKNOWN\', \'CRYPTO_PUNKS\', \'Profile\', \'GenesisKey\', \'GenesisKeyProfile\')')
    await queryRunner.query('ALTER TABLE "nft" ALTER COLUMN "type" TYPE "public"."nft_type_enum" USING "type"::"text"::"public"."nft_type_enum"')
    await queryRunner.query('DROP TYPE "public"."nft_type_enum_old"')
    await queryRunner.query('CREATE INDEX "IDX_574758e1075217237450afe514" ON "nft" ("type", "deletedAt", "createdAt") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_574758e1075217237450afe514"')
    await queryRunner.query('CREATE TYPE "public"."nft_type_enum_old" AS ENUM(\'ERC721\', \'ERC1155\', \'UNKNOWN\', \'Profile\', \'GenesisKey\', \'GenesisKeyProfile\')')
    await queryRunner.query('ALTER TABLE "nft" ALTER COLUMN "type" TYPE "public"."nft_type_enum_old" USING "type"::"text"::"public"."nft_type_enum_old"')
    await queryRunner.query('DROP TYPE "public"."nft_type_enum"')
    await queryRunner.query('ALTER TYPE "public"."nft_type_enum_old" RENAME TO "nft_type_enum"')
    await queryRunner.query('CREATE INDEX "IDX_574758e1075217237450afe514" ON "nft" ("createdAt", "deletedAt", "type") ')
    await queryRunner.query('CREATE TYPE "public"."bid_nfttype_enum_old" AS ENUM(\'ERC721\', \'ERC1155\', \'UNKNOWN\', \'Profile\', \'GenesisKey\', \'GenesisKeyProfile\')')
    await queryRunner.query('ALTER TABLE "bid" ALTER COLUMN "nftType" TYPE "public"."bid_nfttype_enum_old" USING "nftType"::"text"::"public"."bid_nfttype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."bid_nfttype_enum"')
    await queryRunner.query('ALTER TYPE "public"."bid_nfttype_enum_old" RENAME TO "bid_nfttype_enum"')
  }

}
