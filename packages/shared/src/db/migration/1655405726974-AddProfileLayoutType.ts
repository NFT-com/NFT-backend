import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddProfileLayoutType1655405726974 implements MigrationInterface {

  name = 'AddProfileLayoutType1655405726974'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."profile_layouttype_enum" AS ENUM(\'Default\', \'Mosaic\', \'Featured\', \'Spotlight\')')
    await queryRunner.query('ALTER TABLE "profile" ADD "layoutType" "public"."profile_layouttype_enum" NOT NULL DEFAULT \'Default\'')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "layoutType"')
    await queryRunner.query('DROP TYPE "public"."profile_layouttype_enum"')
  }

}
