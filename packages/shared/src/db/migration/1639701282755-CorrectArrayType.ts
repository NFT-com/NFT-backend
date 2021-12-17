import { MigrationInterface, QueryRunner } from 'typeorm'

export class CorrectArrayType1639701282755 implements MigrationInterface {

  name = 'CorrectArrayType1639701282755'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "items"')
    await queryRunner.query('ALTER TABLE "collection" ADD "items" json NOT NULL DEFAULT \'[]\'')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "items"')
    await queryRunner.query('ALTER TABLE "collection" ADD "items" json array NOT NULL DEFAULT \'{}\'')
  }

}
