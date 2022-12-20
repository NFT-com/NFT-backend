import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateTxEntity1671124634025 implements MigrationInterface {

  name = 'UpdateTxEntity1671124634025'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "nftContractAddress" DROP NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "nftContractTokenId" DROP NOT NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "nftContractTokenId" SET NOT NULL')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "nftContractAddress" SET NOT NULL')
  }

}
