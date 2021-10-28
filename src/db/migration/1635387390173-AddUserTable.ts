/* eslint-disable max-len */

import {MigrationInterface, QueryRunner} from 'typeorm'

export class AddUserTable1635387390173 implements MigrationInterface {

    name = 'AddUserTable1635387390173'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('CREATE TABLE "user" ("id" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "email" character varying, "isEmailConfirmed" boolean NOT NULL DEFAULT false, "confirmEmailToken" character varying, "profileURI" character varying, "referredBy" character varying, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))')
        await queryRunner.query('CREATE UNIQUE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") ')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX "public"."IDX_e12875dfb3b1d92d7d7c5377e2"')
        await queryRunner.query('DROP TABLE "user"')
    }

}
