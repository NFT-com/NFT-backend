import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddProfileDisplayMode1653435674541 implements MigrationInterface {

  name = 'AddProfileDisplayMode1653435674541'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."profile_displaytype_enum" AS ENUM(\'NFT\', \'Collection\')')
    await queryRunner.query('ALTER TABLE "profile" ADD "displayType" "public"."profile_displaytype_enum" NOT NULL DEFAULT \'NFT\'')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "displayType"')
    await queryRunner.query('DROP TYPE "public"."profile_displaytype_enum"')
  }

}
