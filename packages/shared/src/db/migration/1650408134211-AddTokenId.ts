import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTokenId1650408134211 implements MigrationInterface {

  name = 'AddTokenId1650408134211'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ADD "tokenId" character varying NOT NULL')
    await queryRunner.query('ALTER TABLE "profile" ADD CONSTRAINT "UQ_059cbff1377f7aa85cca58b333f" UNIQUE ("tokenId")')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP CONSTRAINT "UQ_059cbff1377f7aa85cca58b333f"')
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "tokenId"')
  }

}
