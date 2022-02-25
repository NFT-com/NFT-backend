import { MigrationInterface, QueryRunner } from 'typeorm'

export class ChangeStartEndType1645675737851 implements MigrationInterface {

  name = 'ChangeStartEndType1645675737851'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "market_ask" DROP COLUMN "start"')
    await queryRunner.query('ALTER TABLE "market_ask" ADD "start" integer NOT NULL')
    await queryRunner.query('ALTER TABLE "market_ask" DROP COLUMN "end"')
    await queryRunner.query('ALTER TABLE "market_ask" ADD "end" integer NOT NULL')
    await queryRunner.query('ALTER TABLE "market_bid" DROP COLUMN "start"')
    await queryRunner.query('ALTER TABLE "market_bid" ADD "start" integer NOT NULL')
    await queryRunner.query('ALTER TABLE "market_bid" DROP COLUMN "end"')
    await queryRunner.query('ALTER TABLE "market_bid" ADD "end" integer NOT NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "market_bid" DROP COLUMN "end"')
    await queryRunner.query('ALTER TABLE "market_bid" ADD "end" character varying NOT NULL')
    await queryRunner.query('ALTER TABLE "market_bid" DROP COLUMN "start"')
    await queryRunner.query('ALTER TABLE "market_bid" ADD "start" character varying NOT NULL')
    await queryRunner.query('ALTER TABLE "market_ask" DROP COLUMN "end"')
    await queryRunner.query('ALTER TABLE "market_ask" ADD "end" character varying NOT NULL')
    await queryRunner.query('ALTER TABLE "market_ask" DROP COLUMN "start"')
    await queryRunner.query('ALTER TABLE "market_ask" ADD "start" character varying NOT NULL')
  }

}
