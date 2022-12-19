import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateTxOrderEntity1669621651231 implements MigrationInterface {

  name = 'UpdateTxOrderEntity1669621651231'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_order" ADD "listingId" character varying')
    await queryRunner.query('ALTER TABLE "tx_order" ADD "rejectedAt" TIMESTAMP WITH TIME ZONE')
    await queryRunner.query('ALTER TABLE "tx_order" ADD "memo" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "memo"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "rejectedAt"')
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "listingId"')
  }

}
