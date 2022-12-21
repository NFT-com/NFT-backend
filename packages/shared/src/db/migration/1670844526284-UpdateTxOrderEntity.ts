import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateTxOrderEntity1670844526284 implements MigrationInterface {

  name = 'UpdateTxOrderEntity1670844526284'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_order" ADD "buyNowTaker" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "buyNowTaker"')
  }

}
