import { MigrationInterface, QueryRunner } from 'typeorm'

export class PROFILEGALLERYVISIBLE1648243399261 implements MigrationInterface {

  name = 'PROFILEGALLERYVISIBLE1648243399261'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ADD "showGallery" boolean')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "showGallery"')
  }

}
