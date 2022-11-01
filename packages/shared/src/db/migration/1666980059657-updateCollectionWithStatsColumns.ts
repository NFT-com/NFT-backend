import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateCollectionWithStatsColumns1666980059657 implements MigrationInterface {

  name = 'updateCollectionWithStatsColumns1666980059657'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "base_entity" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_03e6c58047b7a4b3f6de0bfa8d7" PRIMARY KEY ("id"))')
    await queryRunner.query('ALTER TABLE "collection" ADD "floorPrice" numeric')
    await queryRunner.query('ALTER TABLE "collection" ADD "totalVolume" numeric')
    await queryRunner.query('ALTER TABLE "collection" ADD "averagePrice" numeric')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "averagePrice"')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "totalVolume"')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "floorPrice"')
    await queryRunner.query('DROP TABLE "base_entity"')
  }

}
