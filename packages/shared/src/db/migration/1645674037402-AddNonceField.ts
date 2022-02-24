import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddNonceField1645674037402 implements MigrationInterface {

  name = 'AddNonceField1645674037402'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "market_ask" ADD "nonce" integer NOT NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "market_ask" DROP COLUMN "nonce"')
  }

}
