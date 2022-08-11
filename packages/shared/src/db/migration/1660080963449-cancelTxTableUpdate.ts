import { MigrationInterface, QueryRunner } from 'typeorm'

export class cancelTxTableUpdate1660080963449 implements MigrationInterface {

  name = 'cancelTxTableUpdate1660080963449'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "public"."tx_cancel_exchange_enum" AS ENUM(\'OpenSea\', \'LooksRare\')')
    await queryRunner.query('CREATE TYPE "public"."tx_cancel_foreigntype_enum" AS ENUM(\'Listing\', \'Bid\')')
    await queryRunner.query('CREATE TABLE "tx_cancel" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "exchange" "public"."tx_cancel_exchange_enum" NOT NULL, "foreignType" "public"."tx_cancel_foreigntype_enum", "foreignKeyId" character varying NOT NULL, "transactionHash" character varying NOT NULL, "chainId" character varying, "activityId" character varying NOT NULL, CONSTRAINT "REL_c0536d84fa1a459f2fd721f795" UNIQUE ("activityId"), CONSTRAINT "PK_a35fb271e6009eea9c3b84b9934" PRIMARY KEY ("id"))')
    await queryRunner.query('ALTER TABLE "tx_cancel" ADD CONSTRAINT "FK_c0536d84fa1a459f2fd721f795b" FOREIGN KEY ("activityId") REFERENCES "tx_activity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tx_cancel" DROP CONSTRAINT "FK_c0536d84fa1a459f2fd721f795b"')
    await queryRunner.query('DROP TABLE "tx_cancel"')
    await queryRunner.query('DROP TYPE "public"."tx_cancel_foreigntype_enum"')
    await queryRunner.query('DROP TYPE "public"."tx_cancel_exchange_enum"')
  }

}
