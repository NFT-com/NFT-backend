import { MigrationInterface, QueryRunner } from 'typeorm'

export class addHideColumnToEdge1654140851017 implements MigrationInterface {

  name = 'addHideColumnToEdge1654140851017'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "edge" ADD "hide" boolean')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "edge" DROP COLUMN "hide"')
  }

}
