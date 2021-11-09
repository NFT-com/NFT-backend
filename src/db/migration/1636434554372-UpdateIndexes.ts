import {MigrationInterface, QueryRunner} from "typeorm";

export class UpdateIndexes1636434554372 implements MigrationInterface {
    name = 'UpdateIndexes1636434554372'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_507e94bbcf55ced306bf3b72e7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d4535b902eed75d0deb2d515b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6d1d3e44255e3e0cbf68abb3a3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_99ebb4d1a58a8b1f97593402cd"`);
        await queryRunner.query(`CREATE INDEX "IDX_8d22ddaf5542c385971071de14" ON "bid" ("userId", "deletedAt", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_fcf688e53309f9b15699258fb7" ON "bid" ("walletId", "deletedAt", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_7bb009c7c40c5efdd372061dc4" ON "bid" ("profileId", "deletedAt", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_2ce892175f30a263d7f2a48890" ON "bid" ("profileId", "deletedAt", "price") `);
        await queryRunner.query(`CREATE INDEX "IDX_a985aa636a6d548ee30e68b882" ON "nft" ("walletId", "deletedAt", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_9bdcfe1932d4e6a2d63b6964cb" ON "nft" ("userId", "deletedAt", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_91fa6acf35b7416b33a5ed0b4a" ON "nft" ("type", "deletedAt", "createdAt", "profileId") `);
        await queryRunner.query(`CREATE INDEX "IDX_18a053d630815c9fdba26ad1ae" ON "profile" ("ownerUserId", "deletedAt", "createdAt", "status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_18a053d630815c9fdba26ad1ae"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_91fa6acf35b7416b33a5ed0b4a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9bdcfe1932d4e6a2d63b6964cb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a985aa636a6d548ee30e68b882"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2ce892175f30a263d7f2a48890"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7bb009c7c40c5efdd372061dc4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fcf688e53309f9b15699258fb7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8d22ddaf5542c385971071de14"`);
        await queryRunner.query(`CREATE INDEX "IDX_99ebb4d1a58a8b1f97593402cd" ON "profile" ("ownerUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6d1d3e44255e3e0cbf68abb3a3" ON "nft" ("profileId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2d4535b902eed75d0deb2d515b" ON "nft" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_507e94bbcf55ced306bf3b72e7" ON "nft" ("walletId") `);
    }

}
