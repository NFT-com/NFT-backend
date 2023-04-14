import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexTxActivity1681493796001 implements MigrationInterface {
    name = 'AddIndexTxActivity1681493796001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_2b0c110b36a490a5458d253911" ON "base_entity" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_ab18b3a702c6d5ff6bd853291d" ON "activity_feed" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_1f2982fe7c9c7073e284af368b" ON "approval" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_31f2b1f451d82819f2aaacaa9e" ON "bid" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_9fd1f9474c0923071aceac673f" ON "collection" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_81bea0f31829684997049c48cb" ON "comment" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_485506be5838c495c4a0250f15" ON "curation" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_ca6108c7b87e3bd74b73dabe99" ON "edge" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_e95f697ef348eb2bcfdf6248d4" ON "event" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_435405deb738c7ee3566063f55" ON "incentive_action" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_f986b465c280a088cdf47f3b5c" ON "like" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_e3f592e1b576c54e4387d5a596" ON "market_ask" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_6da4af132ebddeed1cc737c342" ON "market_bid" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_18e0ff6a8564519835d7d5f912" ON "marketplace_sale" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_47761568a34a51182d3025a31e" ON "market_swap" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_10498e3e3346fd7b4a0b55642c" ON "wallet" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_7e29a9d6910c10e688b1966a68" ON "nft_owner" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_1e8e7e48ad39fb5fa1d33d1ced" ON "nft" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_5820264d22af1c84247193f02c" ON "nft_port_transaction" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_6ec5c4c0b99116db7ffd238dd6" ON "profile" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_3520611a2d9759c249def15e28" ON "tx_activity" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_e048bf09b355995a38bd48d05f" ON "tx_activity" ("activityType", "status", "expiration", "chainId") `);
        await queryRunner.query(`CREATE INDEX "IDX_90cce957e04f67f8ed39ef522a" ON "tx_cancel" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1f95807f649d6b9b0ac5ddcac" ON "tx_order" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_69ac7595e0d590543b58293557" ON "tx_transaction" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_92f09bd6964a57bb87891a2acf" ON "user" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c1e7619c21ad7f3c452eaa758" ON "view" ("deletedAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_1c1e7619c21ad7f3c452eaa758"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_92f09bd6964a57bb87891a2acf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_69ac7595e0d590543b58293557"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1f95807f649d6b9b0ac5ddcac"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_90cce957e04f67f8ed39ef522a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e048bf09b355995a38bd48d05f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3520611a2d9759c249def15e28"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6ec5c4c0b99116db7ffd238dd6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5820264d22af1c84247193f02c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1e8e7e48ad39fb5fa1d33d1ced"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7e29a9d6910c10e688b1966a68"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_10498e3e3346fd7b4a0b55642c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_47761568a34a51182d3025a31e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_18e0ff6a8564519835d7d5f912"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6da4af132ebddeed1cc737c342"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e3f592e1b576c54e4387d5a596"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f986b465c280a088cdf47f3b5c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_435405deb738c7ee3566063f55"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e95f697ef348eb2bcfdf6248d4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ca6108c7b87e3bd74b73dabe99"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_485506be5838c495c4a0250f15"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_81bea0f31829684997049c48cb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9fd1f9474c0923071aceac673f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_31f2b1f451d82819f2aaacaa9e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1f2982fe7c9c7073e284af368b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ab18b3a702c6d5ff6bd853291d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2b0c110b36a490a5458d253911"`);
    }

}
