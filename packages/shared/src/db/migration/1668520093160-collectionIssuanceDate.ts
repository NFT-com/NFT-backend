import { MigrationInterface, QueryRunner } from 'typeorm'

export class collectionIssuanceDate1668520093160 implements MigrationInterface {

  name = 'collectionIssuanceDate1668520093160'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" ADD "issuanceDate" TIMESTAMP WITH TIME ZONE')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "issuanceDate"')
  }

}
