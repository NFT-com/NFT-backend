import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWeightColumnOnEdge1653984398582 implements MigrationInterface {

  name = 'AddWeightColumnOnEdge1653984398582'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "edge" ADD "weight" character varying')
    await queryRunner.query('ALTER TABLE "nft" ADD CONSTRAINT "UQ_1dcef9ef824117807f3525707e3" UNIQUE ("contract", "tokenId")')
    await queryRunner.query('ALTER TABLE "wallet" ADD CONSTRAINT "UQ_d961f78eb041ecc84687fea35ac" UNIQUE ("address", "network", "chainId")')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "wallet" DROP CONSTRAINT "UQ_d961f78eb041ecc84687fea35ac"')
    await queryRunner.query('ALTER TABLE "nft" DROP CONSTRAINT "UQ_1dcef9ef824117807f3525707e3"')
    await queryRunner.query('ALTER TABLE "edge" DROP COLUMN "weight"')
  }

}
