import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddProfileView1658356169884 implements MigrationInterface {

  name = 'AddProfileView1658356169884'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."profile_profileview_enum" AS ENUM(\'Collection\', \'Gallery\')')
    await queryRunner.query('ALTER TABLE "profile" ADD "profileView" "public"."profile_profileview_enum" NOT NULL DEFAULT \'Gallery\'')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "profileView"')
    await queryRunner.query('DROP TYPE "public"."profile_profileview_enum"')
  }

}
