import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateUserEntity1658941554455 implements MigrationInterface {

  name = 'UpdateUserEntity1658941554455'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_bid" ALTER COLUMN "offer" DROP NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_bid" ALTER COLUMN "consideration" DROP NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_list" ALTER COLUMN "offer" DROP NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_list" ALTER COLUMN "consideration" DROP NOT NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_list" ALTER COLUMN "consideration" SET NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_list" ALTER COLUMN "offer" SET NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_bid" ALTER COLUMN "consideration" SET NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_bid" ALTER COLUMN "offer" SET NOT NULL')
  }

}
