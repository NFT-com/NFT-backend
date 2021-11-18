import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateProfileColType1636387590321 implements MigrationInterface {

  name = 'UpdateProfileColType1636387590321'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_5fbce8b9bbd1cf934117f492d4"')
    await queryRunner.query('ALTER TABLE "profile" ADD CONSTRAINT "UQ_5fbce8b9bbd1cf934117f492d4a" UNIQUE ("url")')
    await queryRunner.query('CREATE INDEX "IDX_5fbce8b9bbd1cf934117f492d4" ON "profile" ("url") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_5fbce8b9bbd1cf934117f492d4"')
    await queryRunner.query('ALTER TABLE "profile" DROP CONSTRAINT "UQ_5fbce8b9bbd1cf934117f492d4a"')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_5fbce8b9bbd1cf934117f492d4" ON "profile" ("url") ')
  }

}
