import { MigrationInterface, QueryRunner } from 'typeorm'

export class RemoveIndexerFields1640276118483 implements MigrationInterface {

  name = 'RemoveIndexerFields1640276118483'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_e12875dfb3b1d92d7d7c5377e2"')
    await queryRunner.query('ALTER TABLE "user" ADD "username" character varying')
    await queryRunner.query('ALTER TABLE "user" ADD CONSTRAINT "UQ_78a916df40e02a9deb1c4b75edb" UNIQUE ("username")')
    await queryRunner.query('ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user" ALTER COLUMN "email" SET NOT NULL')
    await queryRunner.query('ALTER TABLE "user" DROP CONSTRAINT "UQ_78a916df40e02a9deb1c4b75edb"')
    await queryRunner.query('ALTER TABLE "user" DROP COLUMN "username"')
    await queryRunner.query('CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") ')
  }

}
