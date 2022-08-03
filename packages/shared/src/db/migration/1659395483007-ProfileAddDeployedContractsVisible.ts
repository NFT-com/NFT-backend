import { MigrationInterface, QueryRunner } from 'typeorm'

export class ProfileAddDeployedContractsVisible1659395483007 implements MigrationInterface {

  name = 'ProfileAddDeployedContractsVisible1659395483007'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ADD "deployedContractsVisible" boolean DEFAULT false')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "deployedContractsVisible"')
  }

}
