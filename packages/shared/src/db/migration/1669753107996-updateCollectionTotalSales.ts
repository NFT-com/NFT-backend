import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateCollectionTotalSales1669753107996 implements MigrationInterface {
  
  name = 'updateCollectionTotalSales1669753107996'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" ADD "totalSales" integer')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "totalSales"')
  }

}
