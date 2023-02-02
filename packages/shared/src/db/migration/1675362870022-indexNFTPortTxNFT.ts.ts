import { MigrationInterface, QueryRunner } from 'typeorm'

export class indexNFTPortTxNFT1675360976823 implements MigrationInterface {

  name = 'indexNFTPortTxNFT1675360976823'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE nft_port_transaction ALTER COLUMN nft SET DATA TYPE jsonb USING nft::jsonb')
    await queryRunner.query('CREATE INDEX "idx_nft_port_transaction_nft" ON "nft_port_transaction" USING GIN ("nft") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."idx_nft_port_transaction_nft"')
    await queryRunner.query('ALTER TABLE nft_port_transaction ALTER COLUMN nft SET DATA TYPE json USING nft::json')
  }

}
