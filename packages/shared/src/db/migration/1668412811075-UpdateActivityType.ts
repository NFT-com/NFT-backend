import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateActivityType1668412811075 implements MigrationInterface {

  name = 'UpdateActivityType1668412811075'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "public"."tx_activity_activitytype_enum" RENAME TO "tx_activity_activitytype_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."tx_activity_activitytype_enum" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\', \'Swap\')')
    await queryRunner.query('ALTER TABLE "tx_activity" ALTER COLUMN "activityType" TYPE "public"."tx_activity_activitytype_enum" USING "activityType"::"text"::"public"."tx_activity_activitytype_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_activity_activitytype_enum_old"')
    await queryRunner.query('ALTER TYPE "public"."tx_order_ordertype_enum" RENAME TO "tx_order_ordertype_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."tx_order_ordertype_enum" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\', \'Swap\')')
    await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "orderType" TYPE "public"."tx_order_ordertype_enum" USING "orderType"::"text"::"public"."tx_order_ordertype_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_order_ordertype_enum_old"')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_transactiontype_enum" RENAME TO "tx_transaction_transactiontype_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_transactiontype_enum" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\', \'Swap\')')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "transactionType" TYPE "public"."tx_transaction_transactiontype_enum" USING "transactionType"::"text"::"public"."tx_transaction_transactiontype_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_transactiontype_enum_old"')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_transactiontype_enum_old" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "transactionType" TYPE "public"."tx_transaction_transactiontype_enum_old" USING "transactionType"::"text"::"public"."tx_transaction_transactiontype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_transactiontype_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_transactiontype_enum_old" RENAME TO "tx_transaction_transactiontype_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_order_ordertype_enum_old" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "orderType" TYPE "public"."tx_order_ordertype_enum_old" USING "orderType"::"text"::"public"."tx_order_ordertype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_order_ordertype_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_order_ordertype_enum_old" RENAME TO "tx_order_ordertype_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_activity_activitytype_enum_old" AS ENUM(\'Listing\', \'Bid\', \'Cancel\', \'Sale\', \'Transfer\')')
    await queryRunner.query('ALTER TABLE "tx_activity" ALTER COLUMN "activityType" TYPE "public"."tx_activity_activitytype_enum_old" USING "activityType"::"text"::"public"."tx_activity_activitytype_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_activity_activitytype_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_activity_activitytype_enum_old" RENAME TO "tx_activity_activitytype_enum"')
  }

}
