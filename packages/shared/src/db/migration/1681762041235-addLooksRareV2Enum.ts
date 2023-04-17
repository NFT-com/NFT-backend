import { MigrationInterface, QueryRunner } from "typeorm";

export class addLooksRareV2Enum1681762041235 implements MigrationInterface {
    name = 'addLooksRareV2Enum1681762041235'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TYPE "public"."tx_order_protocol_enum" ADD VALUE \'LooksRareV2\'')
        await queryRunner.query('ALTER TYPE "public"."tx_transaction_protocol_enum" ADD VALUE \'LooksRareV2\'')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('This migration cannot be fully undone -- ¯\\_(ツ)_/¯')
    }

}
