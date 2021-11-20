import { MigrationInterface, QueryRunner } from 'typeorm'

export class RemoveCreatorFromProfile1636116725361 implements MigrationInterface {

  name = 'RemoveCreatorFromProfile1636116725361'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "creatorUserId"')
    await queryRunner.query('ALTER TABLE "profile" DROP COLUMN "creatorWalletId"')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // eslint-disable-next-line max-len
    await queryRunner.query('ALTER TABLE "profile" ADD "creatorWalletId" character varying NOT NULL')
    await queryRunner.query('ALTER TABLE "profile" ADD "creatorUserId" character varying NOT NULL')
  }

}
