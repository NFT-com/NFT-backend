import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddNftDescriptionBool1653679832874 implements MigrationInterface {

  name = 'AddNftDescriptionBool1653679832874'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ADD "nftsDescriptionsVisible" boolean')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "nftsDescriptionsVisible"')
  }

}
