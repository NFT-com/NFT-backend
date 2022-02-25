import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddForeignKeysToMarketplaceEntities1645818063181 implements MigrationInterface {

  name = 'AddForeignKeysToMarketplaceEntities1645818063181'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" ADD "marketAskId" character varying')
    await queryRunner.query('ALTER TABLE "nft" ADD "marketBidId" character varying')
    await queryRunner.query('ALTER TABLE "nft" ADD CONSTRAINT "FK_af5e3419d040fc09ca1eb30169f" FOREIGN KEY ("marketAskId") REFERENCES "market_ask"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
    await queryRunner.query('ALTER TABLE "nft" ADD CONSTRAINT "FK_1d74b8a49bc8d7ac3da8ea833a7" FOREIGN KEY ("marketBidId") REFERENCES "market_bid"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" DROP CONSTRAINT "FK_1d74b8a49bc8d7ac3da8ea833a7"')
    await queryRunner.query('ALTER TABLE "nft" DROP CONSTRAINT "FK_af5e3419d040fc09ca1eb30169f"')
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "marketBidId"')
    await queryRunner.query('ALTER TABLE "nft" DROP COLUMN "marketAskId"')
  }

}
