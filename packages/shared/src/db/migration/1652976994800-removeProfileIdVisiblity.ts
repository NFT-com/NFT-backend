import { MigrationInterface, QueryRunner } from 'typeorm'

export class removeProfileIdVisiblity1652976994800 implements MigrationInterface {

  name = 'removeProfileIdVisiblity1652976994800'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_91fa6acf35b7416b33a5ed0b4a"')
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "profileId"')
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "visibility"')
    await queryRunner.query('CREATE INDEX "IDX_574758e1075217237450afe514" ON "nft" ("type", "deletedAt", "createdAt") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_574758e1075217237450afe514"')
    await queryRunner.query('ALTER TABLE "nft" ADD "visibility" boolean DEFAULT false')
    await queryRunner.query('ALTER TABLE "nft" ADD "profileId" character varying')
    await queryRunner.query('CREATE INDEX "IDX_91fa6acf35b7416b33a5ed0b4a" ON "nft" ("createdAt", "deletedAt", "profileId", "type") ')
  }

}
