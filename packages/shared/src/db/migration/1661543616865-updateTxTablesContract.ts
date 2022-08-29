import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateTxTablesContract1661543616865 implements MigrationInterface {

  name = 'updateTxTablesContract1661543616865'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_activity" ADD "nftContract" character varying NOT NULL DEFAULT \'0x\'')
    await queryRunner.query('ALTER TYPE "public"."tx_order_protocol_enum" RENAME TO "tx_order_protocol_enum_old"')
    await queryRunner.query('CREATE TYPE "public"."tx_order_protocol_enum" AS ENUM(\'Seaport\', \'LooksRare\')')
    await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "protocol" TYPE "public"."tx_order_protocol_enum" USING "protocol"::"text"::"public"."tx_order_protocol_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_order_protocol_enum_old"')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."tx_order_protocol_enum_old" AS ENUM(\'Wyvern\', \'Seaport\', \'LooksRare\')')
    await queryRunner.query('ALTER TABLE "tx_order" ALTER COLUMN "protocol" TYPE "public"."tx_order_protocol_enum_old" USING "protocol"::"text"::"public"."tx_order_protocol_enum_old"')
    await queryRunner.query('DROP TYPE "public"."tx_order_protocol_enum"')
    await queryRunner.query('ALTER TYPE "public"."tx_order_protocol_enum_old" RENAME TO "tx_order_protocol_enum"')
    await queryRunner.query('ALTER TABLE "tx_activity" DROP COLUMN "nftContract"')
  }

}
