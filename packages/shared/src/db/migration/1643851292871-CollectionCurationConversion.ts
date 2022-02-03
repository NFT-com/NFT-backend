import { MigrationInterface, QueryRunner } from 'typeorm'

export class CollectionCurationConversion1643851292871 implements MigrationInterface {

  name = 'CollectionCurationConversion1643851292871'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_ca25eb01f75a85272300f33602"')
    await queryRunner.query('CREATE TABLE "curation" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "items" json NOT NULL DEFAULT \'[]\', "userId" character varying NOT NULL, CONSTRAINT "PK_de0e4d1c645b4bc2e9a26b9a3f1" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE INDEX "IDX_2d96271c65f68abee85b67a850" ON "curation" ("userId") ')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "userId"')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "items"')
    await queryRunner.query('ALTER TABLE "collection" ADD "contract" character varying NOT NULL')
    await queryRunner.query('ALTER TABLE "collection" ADD "name" character varying')
    await queryRunner.query('CREATE INDEX "IDX_e814aff6539600dfcc88af41fc" ON "collection" ("contract") ')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_e814aff6539600dfcc88af41fc"')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "name"')
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN "contract"')
    await queryRunner.query('ALTER TABLE "collection" ADD "items" json NOT NULL DEFAULT \'[]\'')
    await queryRunner.query('ALTER TABLE "collection" ADD "userId" character varying NOT NULL')
    await queryRunner.query('DROP INDEX "public"."IDX_2d96271c65f68abee85b67a850"')
    await queryRunner.query('DROP TABLE "curation"')
    await queryRunner.query('CREATE INDEX "IDX_ca25eb01f75a85272300f33602" ON "collection" ("userId") ')
  }

}
