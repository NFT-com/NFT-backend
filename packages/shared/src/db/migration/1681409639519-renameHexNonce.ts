import { MigrationInterface, QueryRunner } from "typeorm";

export class renameHexNonce1681409639519 implements MigrationInterface {
    name = 'renameHexNonce1681409639519'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tx_order" RENAME COLUMN "osNonce" TO "hexNonce"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tx_order" RENAME COLUMN "hexNonce" TO "osNonce"`);
    }

}
