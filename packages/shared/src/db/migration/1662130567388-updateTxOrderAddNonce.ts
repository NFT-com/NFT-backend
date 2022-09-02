import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateTxOrderAddNonce1662130567388 implements MigrationInterface {

  name = 'updateTxOrderAddNonce1662130567388'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_order" ADD "nonce" integer')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "nonce"')
  }

}
