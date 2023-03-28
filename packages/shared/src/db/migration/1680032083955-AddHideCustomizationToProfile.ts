import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHideCustomizationToProfile1680032083955 implements MigrationInterface {
    name = 'AddHideCustomizationToProfile1680032083955'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "profile" ADD "hideCustomization" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "profile" DROP COLUMN "hideCustomization"`);
    }

}
