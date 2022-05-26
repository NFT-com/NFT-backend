import { MigrationInterface, QueryRunner } from 'typeorm'

export class NftContract1653583447293 implements MigrationInterface {

  name = 'NftContract1653583447293'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE INDEX "IDX_a7790bf5973b812eddcbcfd71a" ON "nft" ("contract", "deletedAt", "createdAt") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_a7790bf5973b812eddcbcfd71a"')
  }

}
