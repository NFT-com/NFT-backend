import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateNFTPortTransaction1675190544721 implements MigrationInterface {

  name = 'updateNFTPortTransaction1675190544721'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft_port_transaction" ADD "chainId" character varying')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft_port_transaction" DROP COLUMN "chainId"')
  }

}
