import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateActivityStatus1661953267493 implements MigrationInterface {

  name = 'updateActivityStatus1661953267493'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."tx_activity_status_enum" AS ENUM(\'Valid\', \'Cancelled\', \'Executed\')')
    await queryRunner.query('ALTER TABLE "tx_activity" ADD "status" "public"."tx_activity_status_enum" NOT NULL DEFAULT \'Valid\'')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_activity" DROP COLUMN "status"')
    await queryRunner.query('DROP TYPE "public"."tx_activity_status_enum"')
  }

}
