import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateTxOrder1668623108110 implements MigrationInterface {

  name = 'UpdateTxOrder1668623108110'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_order" ADD "createdInternally" boolean NOT NULL DEFAULT false')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "createdInternally"')
  }

}
