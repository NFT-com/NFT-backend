import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateIncentiveAction1674028887739 implements MigrationInterface {

  name = 'UpdateIncentiveAction1674028887739'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "incentive_action" DROP CONSTRAINT "UQ_512d281d21292941edce250bcce"')
    await queryRunner.query('ALTER TABLE "incentive_action" ALTER COLUMN "userId" DROP NOT NULL')
    await queryRunner.query('ALTER TABLE "incentive_action" ADD CONSTRAINT "UQ_512d281d21292941edce250bcce" UNIQUE ("userId", "profileUrl", "task")')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "incentive_action" DROP CONSTRAINT "UQ_512d281d21292941edce250bcce"')
    await queryRunner.query('ALTER TABLE "incentive_action" ALTER COLUMN "userId" SET NOT NULL')
    await queryRunner.query('ALTER TABLE "incentive_action" ADD CONSTRAINT "UQ_512d281d21292941edce250bcce" UNIQUE ("userId", "profileUrl", "task")')
  }

}
