import { MigrationInterface, QueryRunner } from 'typeorm'

export class updateEdgeConstraint1656099811820 implements MigrationInterface {

  name = 'updateEdgeConstraint1656099811820'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "edge" ADD CONSTRAINT "UQ_06513d9b1b0a820f018f5f1ac65" UNIQUE ("thisEntityType", "thatEntityType", "thisEntityId", "thatEntityId", "edgeType")')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "edge" DROP CONSTRAINT "UQ_06513d9b1b0a820f018f5f1ac65"')
  }

}
