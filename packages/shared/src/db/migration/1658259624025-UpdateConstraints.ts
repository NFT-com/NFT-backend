import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateConstraints1658259624025 implements MigrationInterface {

  name = 'UpdateConstraints1658259624025'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "nft" DROP CONSTRAINT "UQ_1dcef9ef824117807f3525707e3"')
    await queryRunner.query('ALTER TABLE "collection" DROP CONSTRAINT "UQ_e814aff6539600dfcc88af41fc7"')
    await queryRunner.query('ALTER TABLE "profile" DROP CONSTRAINT "UQ_5fbce8b9bbd1cf934117f492d4a"')
    await queryRunner.query('ALTER TABLE "profile" DROP CONSTRAINT "UQ_059cbff1377f7aa85cca58b333f"')
    await queryRunner.query('ALTER TABLE "collection" ADD CONSTRAINT "UQ_4fa2fe028d2521ba46f4085f567" UNIQUE ("contract", "chainId")')
    await queryRunner.query('ALTER TABLE "nft" ADD CONSTRAINT "UQ_2e95b4a70bfeb4f3d044baf6775" UNIQUE ("contract", "tokenId", "chainId")')
    await queryRunner.query('ALTER TABLE "profile" ADD CONSTRAINT "UQ_bb1ff0327c8b340f4e124563516" UNIQUE ("url", "tokenId")')
    await queryRunner.query('ALTER TABLE "profile" ADD CONSTRAINT "UQ_a60669c1b37573223c2724db52d" UNIQUE ("tokenId", "chainId")')
    await queryRunner.query('ALTER TABLE "profile" ADD CONSTRAINT "UQ_2c404ac8a5196636c359919d060" UNIQUE ("url", "chainId")')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "profile" DROP CONSTRAINT "UQ_2c404ac8a5196636c359919d060"')
    await queryRunner.query('ALTER TABLE "profile" DROP CONSTRAINT "UQ_a60669c1b37573223c2724db52d"')
    await queryRunner.query('ALTER TABLE "profile" DROP CONSTRAINT "UQ_bb1ff0327c8b340f4e124563516"')
    await queryRunner.query('ALTER TABLE "nft" DROP CONSTRAINT "UQ_2e95b4a70bfeb4f3d044baf6775"')
    await queryRunner.query('ALTER TABLE "collection" DROP CONSTRAINT "UQ_4fa2fe028d2521ba46f4085f567"')
    await queryRunner.query('ALTER TABLE "profile" ADD CONSTRAINT "UQ_059cbff1377f7aa85cca58b333f" UNIQUE ("tokenId")')
    await queryRunner.query('ALTER TABLE "profile" ADD CONSTRAINT "UQ_5fbce8b9bbd1cf934117f492d4a" UNIQUE ("url")')
    await queryRunner.query('ALTER TABLE "collection" ADD CONSTRAINT "UQ_e814aff6539600dfcc88af41fc7" UNIQUE ("contract")')
    await queryRunner.query('ALTER TABLE "nft" ADD CONSTRAINT "UQ_1dcef9ef824117807f3525707e3" UNIQUE ("contract", "tokenId")')
  }

}
