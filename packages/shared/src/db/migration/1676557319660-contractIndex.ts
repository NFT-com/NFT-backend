import { MigrationInterface, QueryRunner } from 'typeorm'

export class contractIndex1676557319660 implements MigrationInterface {

  name = 'contractIndex1676557319660'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE INDEX "IDX_c0b946f2b734f08245c039a772" ON "tx_activity" ("nftContract") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_c0b946f2b734f08245c039a772"')
  }

}
