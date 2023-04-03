import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTokenURI1680537469113 implements MigrationInterface {
    name = 'AddTokenURI1680537469113'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "nft" ADD "uriString" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "nft" DROP COLUMN "uriString"`);
    }

}
