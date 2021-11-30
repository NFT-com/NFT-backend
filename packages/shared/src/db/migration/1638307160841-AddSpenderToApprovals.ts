import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSpenderToApprovals1638307160841 implements MigrationInterface {

  name = 'AddSpenderToApprovals1638307160841'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "approval" ADD "spender" character varying NOT NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "approval" DROP COLUMN "spender"')
  }

}
