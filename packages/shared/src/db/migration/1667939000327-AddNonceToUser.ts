import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddNonceToUser1667939000327 implements MigrationInterface {

  name = 'AddNonceToUser1667939000327'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user" ADD "nonce" numeric NOT NULL DEFAULT \'549191\'')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user" DROP COLUMN "nonce"')
  }

}
