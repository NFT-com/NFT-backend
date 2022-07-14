import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddConstraintToCollection1657642158244 implements MigrationInterface {

  name = 'AddConstraintToCollection1657642158244'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" ADD CONSTRAINT "UQ_e814aff6539600dfcc88af41fc7" UNIQUE ("contract")')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" DROP CONSTRAINT "UQ_e814aff6539600dfcc88af41fc7"')
  }

}
