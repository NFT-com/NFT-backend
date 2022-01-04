import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddEvents1641312704033 implements MigrationInterface {

  name = 'AddEvents1641312704033'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "event" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "chainId" integer NOT NULL, "contract" character varying NOT NULL, "eventName" character varying NOT NULL, "txHash" character varying NOT NULL, "ownerAddress" character varying, "profileUrl" character varying, CONSTRAINT "PK_30c2f3bbaf6d34a55f8ae6e4614" PRIMARY KEY ("id"))')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "event"')
  }

}
