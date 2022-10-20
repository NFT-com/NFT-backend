import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateNFTEntity1666284466279 implements MigrationInterface {

  name = 'updateNFTEntity1666284466279'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_9bdcfe1932d4e6a2d63b6964cb"')
    await queryRunner.query('DROP INDEX "public"."IDX_a985aa636a6d548ee30e68b882"')
    await queryRunner.query('ALTER TABLE "nft" ALTER COLUMN "userId" DROP NOT NULL')
    await queryRunner.query('ALTER TABLE "nft" ALTER COLUMN "walletId" DROP NOT NULL')
    await queryRunner.query('CREATE INDEX "IDX_a985aa636a6d548ee30e68b882" ON "nft" ("walletId", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE INDEX "IDX_9bdcfe1932d4e6a2d63b6964cb" ON "nft" ("userId", "deletedAt", "createdAt") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_9bdcfe1932d4e6a2d63b6964cb"')
    await queryRunner.query('DROP INDEX "public"."IDX_a985aa636a6d548ee30e68b882"')
    await queryRunner.query('ALTER TABLE "nft" ALTER COLUMN "walletId" SET NOT NULL')
    await queryRunner.query('ALTER TABLE "nft" ALTER COLUMN "userId" SET NOT NULL')
    await queryRunner.query('CREATE INDEX "IDX_a985aa636a6d548ee30e68b882" ON "nft" ("createdAt", "deletedAt", "walletId") ')
    await queryRunner.query('CREATE INDEX "IDX_9bdcfe1932d4e6a2d63b6964cb" ON "nft" ("createdAt", "deletedAt", "userId") ')
  }

}
