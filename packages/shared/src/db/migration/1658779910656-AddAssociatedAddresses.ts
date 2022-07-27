import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAssociatedAddresses1658779910656 implements MigrationInterface {

  name = 'AddAssociatedAddresses1658779910656'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ADD "associatedAddresses" json DEFAULT \'[]\'')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "associatedAddresses"')
  }

}
