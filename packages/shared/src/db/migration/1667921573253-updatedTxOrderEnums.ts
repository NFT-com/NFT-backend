import { MigrationInterface, QueryRunner } from 'typeorm'

export class updatedTxOrderEnums1667921573253 implements MigrationInterface {

  name = 'updatedTxOrderEnums1667921573253'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "public"."tx_cancel_exchange_enum" RENAME TO "tx_cancel_exchange_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."tx_cancel_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_cancel" ALTER COLUMN "exchange" TYPE "public"."tx_cancel_exchange_enum" USING "exchange"::"text"::"public"."tx_cancel_exchange_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_cancel_exchange_enum_old"')
    await queryRunner.query('ALTER TYPE "public"."tx_order_exchange_enum" RENAME TO "tx_order_exchange_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."tx_order_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "exchange" TYPE "public"."tx_order_exchange_enum" USING "exchange"::"text"::"public"."tx_order_exchange_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_order_exchange_enum_old"')
    await queryRunner.query('ALTER TYPE "public"."tx_order_protocol_enum" RENAME TO "tx_order_protocol_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."tx_order_protocol_enum" AS ENUM(\'Seaport\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "protocol" TYPE "public"."tx_order_protocol_enum" USING "protocol"::"text"::"public"."tx_order_protocol_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_order_protocol_enum_old"')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_exchange_enum" RENAME TO "tx_transaction_exchange_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "exchange" TYPE "public"."tx_transaction_exchange_enum" USING "exchange"::"text"::"public"."tx_transaction_exchange_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_exchange_enum_old"')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_protocol_enum" RENAME TO "tx_transaction_protocol_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_protocol_enum" AS ENUM(\'Seaport\', \'LooksRare\', \'X2Y2\')')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "protocol" TYPE "public"."tx_transaction_protocol_enum" USING "protocol"::"text"::"public"."tx_transaction_protocol_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_protocol_enum_old"')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_protocol_enum_old" AS ENUM(\'Seaport\', \'LooksRare\')')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "protocol" TYPE "public"."tx_transaction_protocol_enum_old" USING "protocol"::"text"::"public"."tx_transaction_protocol_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_protocol_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_protocol_enum_old" RENAME TO "tx_transaction_protocol_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_transaction_exchange_enum_old" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('ALTER TABLE "tx_transaction" ALTER COLUMN "exchange" TYPE "public"."tx_transaction_exchange_enum_old" USING "exchange"::"text"::"public"."tx_transaction_exchange_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_transaction_exchange_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_transaction_exchange_enum_old" RENAME TO "tx_transaction_exchange_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_order_protocol_enum_old" AS ENUM(\'Seaport\', \'LooksRare\')')
    await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "protocol" TYPE "public"."tx_order_protocol_enum_old" USING "protocol"::"text"::"public"."tx_order_protocol_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_order_protocol_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_order_protocol_enum_old" RENAME TO "tx_order_protocol_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_order_exchange_enum_old" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "exchange" TYPE "public"."tx_order_exchange_enum_old" USING "exchange"::"text"::"public"."tx_order_exchange_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_order_exchange_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_order_exchange_enum_old" RENAME TO "tx_order_exchange_enum"')
    await queryRunner.query('CREATE TYPE "public"."tx_cancel_exchange_enum_old" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('ALTER TABLE "tx_cancel" ALTER COLUMN "exchange" TYPE "public"."tx_cancel_exchange_enum_old" USING "exchange"::"text"::"public"."tx_cancel_exchange_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_cancel_exchange_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_cancel_exchange_enum_old" RENAME TO "tx_cancel_exchange_enum"')
  }

}
