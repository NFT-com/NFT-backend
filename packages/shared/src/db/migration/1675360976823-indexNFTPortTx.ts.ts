import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateNFTPortTransaction1675190544721 implements MigrationInterface {

  name = 'indexNFTPortTx.ts1675360976823'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE INDEX "IDX_9e1c62c71d2693b0e3483b71fc" ON "nft_port_transaction" ("type", "contractAddress", "tokenId", "transactionHash", "blockNumber", "blockHash", "chainId") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_9e1c62c71d2693b0e3483b71fc"')
  }

}