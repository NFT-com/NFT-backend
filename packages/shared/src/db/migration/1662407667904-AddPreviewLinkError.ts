import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPreviewLinkError1662407667904 implements MigrationInterface {

  name = 'AddPreviewLinkError1662407667904'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" ADD "previewLinkError" character varying(2000)')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "previewLinkError"')
  }

}
