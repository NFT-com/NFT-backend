import { MigrationInterface, QueryRunner } from 'typeorm'

export class addIndexTxOrder1668178636174 implements MigrationInterface {

  name = 'addIndexTxOrder1668178636174'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE INDEX "IDX_83f602f1b4e1749ca7b9205df4" ON "tx_order" ("makerAddress", "exchange", "nonce") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_83f602f1b4e1749ca7b9205df4"')
  }

}
