import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWatchlist1646771595179 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "watchlist" ("id" character varying NOT NULL, "userId" character varying NOT NULL, "title" character varying NOT NULL)')
    await queryRunner.query('CREATE TABLE "watchlist_item" ("id" character varying NOT NULL, "inWatchlist" character varying NOT NULL, "itemId" character varying NOT NULL)')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "watchlist"')
    await queryRunner.query('DROP TABLE "watchlist_item"')
  }

}
