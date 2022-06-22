import { MigrationInterface, QueryRunner } from 'typeorm'

export class MakeDescriptionTrueByDefault1655853600418 implements MigrationInterface {

  name = 'MakeDescriptionTrueByDefault1655853600418'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ALTER COLUMN "nftsDescriptionsVisible" SET DEFAULT true')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" ALTER COLUMN "nftsDescriptionsVisible" DROP DEFAULT')
  }

}
