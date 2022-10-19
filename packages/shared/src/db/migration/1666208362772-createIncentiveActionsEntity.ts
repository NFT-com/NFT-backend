import { MigrationInterface, QueryRunner } from 'typeorm'

export class createIncentiveActionsEntity1666208362772 implements MigrationInterface {

  name = 'createIncentiveActionsEntity1666208362772'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."incentive_actions_entity_task_enum" AS ENUM(\'CREATE_NFT_PROFILE\', \'CUSTOMIZE_PROFILE\', \'REFER_NETWORK\', \'BUY_NFTS\', \'LIST_NFTS\', \'ISSUE_NFTS\')')
    await queryRunner.query('CREATE TABLE "incentive_actions_entity" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userId" character varying NOT NULL, "profileUrl" character varying NOT NULL, "task" "public"."incentive_actions_entity_task_enum" NOT NULL, "point" integer NOT NULL, CONSTRAINT "PK_6f9cbaa9c7f9d6fc05d79213815" PRIMARY KEY ("id"))')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "incentive_actions_entity"')
    await queryRunner.query('DROP TYPE "public"."incentive_actions_entity_task_enum"')
  }

}
