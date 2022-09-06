import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateTxActivityAddExpiration1662150093231 implements MigrationInterface {

  name = 'updateTxActivityAddExpiration1662150093231'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_activity" ADD "expiration" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_activity" DROP COLUMN "expiration"')
  }

}
