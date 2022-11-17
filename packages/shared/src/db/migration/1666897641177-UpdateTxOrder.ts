import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateTxOrder1666897641177 implements MigrationInterface {

  name = 'UpdateTxOrder1666897641177'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "createdInternally"')
    // await queryRunner.query('ALTER TABLE "tx_order" ADD "createdInternally" boolean NOT NULL DEFAULT false')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async down(queryRunner: QueryRunner): Promise<void> {
    // await queryRunner.query('ALTER TABLE "tx_order" DROP COLUMN "createdInternally"')
  }

}
