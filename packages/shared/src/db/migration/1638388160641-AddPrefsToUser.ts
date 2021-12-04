import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPrefsToUser1638388160641 implements MigrationInterface {

  name = 'AddPrefsToUser1638388160641'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user" ADD "preferences" json NOT NULL DEFAULT \'{"bidActivityNotifications":true,"priceChangeNotifications":true,"outbidNotifications":true,"purchaseSuccessNotifications":true,"promotionalNotifications":true}\'')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user" DROP COLUMN "preferences"')
  }

}
