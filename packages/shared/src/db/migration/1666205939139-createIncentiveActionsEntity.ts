import { MigrationInterface, QueryRunner } from 'typeorm'

export class createIncentiveActionsEntity1666205939139 implements MigrationInterface {

  name = 'createIncentiveActionsEntity1666205939139'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "incentive_actions_entity" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userId" character varying NOT NULL, "profileUrl" character varying NOT NULL, "task" character varying NOT NULL, "point" integer NOT NULL, CONSTRAINT "PK_6f9cbaa9c7f9d6fc05d79213815" PRIMARY KEY ("id"))')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "incentive_actions_entity"')
  }

}
