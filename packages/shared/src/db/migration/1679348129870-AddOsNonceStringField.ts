import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOsNonceStringField1679348129870 implements MigrationInterface {
    name = 'AddOsNonceStringField1679348129870'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tx_order" ADD "osNonce" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tx_order" DROP COLUMN "osNonce"`);
    }

}
