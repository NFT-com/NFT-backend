import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateTxActivityAddReadTimestamp1662756269625 implements MigrationInterface {

  name = 'updateTxActivityAddReadTimestamp1662756269625'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_activity" ADD "readTimestamp" TIMESTAMP WITH TIME ZONE')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_activity" DROP COLUMN "readTimestamp"')
  }

}
