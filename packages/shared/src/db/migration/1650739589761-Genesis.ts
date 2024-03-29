import { MigrationInterface, QueryRunner } from 'typeorm'

export class Genesis1650739589761 implements MigrationInterface {

  name = 'Genesis1650739589761'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "approval" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "amount" character varying NOT NULL, "currency" character varying NOT NULL, "deadline" character varying NOT NULL, "nonce" integer NOT NULL, "signature" json NOT NULL, "txHash" character varying NOT NULL, "userId" character varying NOT NULL, "walletId" character varying NOT NULL, "spender" character varying NOT NULL, CONSTRAINT "PK_97bfd1cd9dff3c1302229da6b5c" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE INDEX "IDX_f72b9f75117746878f7b44012e" ON "approval" ("userId") ')
    await queryRunner.query('CREATE INDEX "IDX_2ca1849f697a2a1eda435863fa" ON "approval" ("walletId") ')
    await queryRunner.query('CREATE TYPE "public"."bid_nfttype_enum" AS ENUM(\'ERC721\', \'ERC1155\', \'Profile\', \'GenesisKey\', \'GenesisKeyProfile\')')
    await queryRunner.query('CREATE TYPE "public"."bid_status_enum" AS ENUM(\'Executed\', \'Submitted\')')
    await queryRunner.query('CREATE TABLE "bid" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "nftType" "public"."bid_nfttype_enum" NOT NULL, "price" character varying NOT NULL, "profileId" character varying, "signature" json NOT NULL, "stakeWeightedSeconds" integer, "status" "public"."bid_status_enum" NOT NULL, "userId" character varying NOT NULL, "walletId" character varying NOT NULL, CONSTRAINT "PK_ed405dda320051aca2dcb1a50bb" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE INDEX "IDX_8898792509b9d174c32d5f10ed" ON "bid" ("profileId") ')
    await queryRunner.query('CREATE INDEX "IDX_b0f254bd6d29d3da2b6a8af262" ON "bid" ("userId") ')
    await queryRunner.query('CREATE INDEX "IDX_e5fe9523948edab80df1cb14ea" ON "bid" ("walletId") ')
    await queryRunner.query('CREATE INDEX "IDX_8d22ddaf5542c385971071de14" ON "bid" ("userId", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE INDEX "IDX_fcf688e53309f9b15699258fb7" ON "bid" ("walletId", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE INDEX "IDX_7bb009c7c40c5efdd372061dc4" ON "bid" ("profileId", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE INDEX "IDX_2ce892175f30a263d7f2a48890" ON "bid" ("profileId", "deletedAt", "price") ')
    await queryRunner.query('CREATE TABLE "collection" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "contract" character varying NOT NULL, "name" character varying, CONSTRAINT "PK_ad3f485bbc99d875491f44d7c85" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE INDEX "IDX_e814aff6539600dfcc88af41fc" ON "collection" ("contract") ')
    await queryRunner.query('CREATE TABLE "curation" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "items" json NOT NULL DEFAULT \'[]\', "userId" character varying NOT NULL, CONSTRAINT "PK_de0e4d1c645b4bc2e9a26b9a3f1" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE INDEX "IDX_2d96271c65f68abee85b67a850" ON "curation" ("userId") ')
    await queryRunner.query('CREATE TYPE "public"."edge_thisentitytype_enum" AS ENUM(\'Approval\', \'Bid\', \'Curation\', \'Collection\', \'Edge\', \'NFT\', \'Profile\', \'User\', \'Wallet\')')
    await queryRunner.query('CREATE TYPE "public"."edge_thatentitytype_enum" AS ENUM(\'Approval\', \'Bid\', \'Curation\', \'Collection\', \'Edge\', \'NFT\', \'Profile\', \'User\', \'Wallet\')')
    await queryRunner.query('CREATE TYPE "public"."edge_edgetype_enum" AS ENUM(\'Follows\', \'Referred\', \'Displays\', \'Includes\', \'Watches\')')
    await queryRunner.query('CREATE TABLE "edge" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "collectionId" character varying, "thisEntityId" character varying NOT NULL, "thisEntityType" "public"."edge_thisentitytype_enum" NOT NULL, "thatEntityId" character varying NOT NULL, "thatEntityType" "public"."edge_thatentitytype_enum" NOT NULL, "edgeType" "public"."edge_edgetype_enum" NOT NULL, CONSTRAINT "PK_bf6f43c9af56d05094d8c57b311" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE INDEX "IDX_6d05b97f6bd418e7349581ce79" ON "edge" ("thisEntityId", "thatEntityId", "edgeType", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_0782d1067dcf4c7496e49a8142" ON "edge" ("thatEntityId", "edgeType", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE INDEX "IDX_cff1a3063eecfa8690eb323b7d" ON "edge" ("thisEntityId", "edgeType", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE INDEX "IDX_4c27707fc3097cd748073acb32" ON "edge" ("collectionId", "edgeType", "thatEntityType", "thatEntityId", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_a4db743307da136f0a33734301" ON "edge" ("collectionId", "edgeType", "thatEntityType", "deletedAt") ')
    await queryRunner.query('CREATE INDEX "IDX_3447756fead163cc28da29f50b" ON "edge" ("collectionId", "edgeType", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_6daf260f04aad49c0e164fe8ac" ON "edge" ("collectionId", "edgeType", "thatEntityId", "thisEntityId", "deletedAt") ')
    await queryRunner.query('CREATE TABLE "event" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "chainId" integer NOT NULL, "contract" character varying NOT NULL, "eventName" character varying NOT NULL, "txHash" character varying NOT NULL, "ownerAddress" character varying, "profileUrl" character varying, CONSTRAINT "PK_30c2f3bbaf6d34a55f8ae6e4614" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."market_ask_auctiontype_enum" AS ENUM(\'FixedPrice\', \'English\', \'Decreasing\')')
    await queryRunner.query('CREATE TABLE "market_ask" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "structHash" character varying NOT NULL, "nonce" integer NOT NULL, "auctionType" "public"."market_ask_auctiontype_enum" NOT NULL, "signature" json NOT NULL, "makerAddress" character varying NOT NULL, "makeAsset" json NOT NULL DEFAULT \'[]\', "takerAddress" character varying NOT NULL, "takeAsset" json NOT NULL DEFAULT \'[]\', "buyNowTaker" character varying, "marketSwapId" character varying, "approvalTxHash" character varying, "cancelTxHash" character varying, "start" integer NOT NULL, "end" integer NOT NULL, "salt" integer NOT NULL, "offerAcceptedAt" TIMESTAMP WITH TIME ZONE, "chainId" character varying NOT NULL, CONSTRAINT "PK_0e14a9d9529711138496a7f50f9" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."market_bid_auctiontype_enum" AS ENUM(\'FixedPrice\', \'English\', \'Decreasing\')')
    await queryRunner.query('CREATE TABLE "market_bid" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "structHash" character varying NOT NULL, "nonce" integer NOT NULL, "auctionType" "public"."market_bid_auctiontype_enum" NOT NULL, "signature" json NOT NULL, "marketAskId" character varying NOT NULL, "makerAddress" character varying NOT NULL, "makeAsset" json NOT NULL DEFAULT \'[]\', "takerAddress" character varying NOT NULL, "takeAsset" json NOT NULL DEFAULT \'[]\', "marketSwapId" character varying, "approvalTxHash" character varying, "cancelTxHash" character varying, "message" text NOT NULL, "start" integer NOT NULL, "end" integer NOT NULL, "salt" integer NOT NULL, "acceptedAt" TIMESTAMP WITH TIME ZONE, "rejectedAt" TIMESTAMP WITH TIME ZONE, "rejectedReason" text, "chainId" character varying NOT NULL, CONSTRAINT "PK_fd0ed65ad223d87b7651b8f4bd7" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TABLE "market_swap" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "txHash" character varying NOT NULL, "blockNumber" character varying NOT NULL, "private" boolean NOT NULL DEFAULT false, "marketAskId" character varying, "marketBidId" character varying, CONSTRAINT "REL_c27294251ee1c5d9c03f95ddf2" UNIQUE ("marketAskId"), CONSTRAINT "REL_23438b727a123a21411db77cee" UNIQUE ("marketBidId"), CONSTRAINT "PK_d6fc2d87c047f12ad956393af38" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE TYPE "public"."nft_type_enum" AS ENUM(\'ERC721\', \'ERC1155\', \'Profile\', \'GenesisKey\', \'GenesisKeyProfile\')')
    await queryRunner.query('CREATE TABLE "nft" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "contract" character varying, "tokenId" character varying NOT NULL, "metadata" json NOT NULL, "price" character varying, "profileId" character varying, "type" "public"."nft_type_enum" NOT NULL, "userId" character varying NOT NULL, "walletId" character varying NOT NULL, CONSTRAINT "PK_8f46897c58e23b0e7bf6c8e56b0" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE INDEX "IDX_a985aa636a6d548ee30e68b882" ON "nft" ("walletId", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE INDEX "IDX_9bdcfe1932d4e6a2d63b6964cb" ON "nft" ("userId", "deletedAt", "createdAt") ')
    await queryRunner.query('CREATE INDEX "IDX_91fa6acf35b7416b33a5ed0b4a" ON "nft" ("type", "deletedAt", "createdAt", "profileId") ')
    await queryRunner.query('CREATE TYPE "public"."profile_status_enum" AS ENUM(\'Available\', \'Pending\', \'Owned\')')
    await queryRunner.query('CREATE TABLE "profile" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "url" character varying NOT NULL, "ownerUserId" character varying, "ownerWalletId" character varying, "tokenId" character varying, "status" "public"."profile_status_enum" NOT NULL DEFAULT \'Available\', "bannerURL" character varying, "photoURL" character varying, "description" character varying, "showGallery" boolean, CONSTRAINT "UQ_5fbce8b9bbd1cf934117f492d4a" UNIQUE ("url"), CONSTRAINT "UQ_059cbff1377f7aa85cca58b333f" UNIQUE ("tokenId"), CONSTRAINT "PK_3dd8bfc97e4a77c70971591bdcb" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE INDEX "IDX_5fbce8b9bbd1cf934117f492d4" ON "profile" ("url") ')
    await queryRunner.query('CREATE INDEX "IDX_18a053d630815c9fdba26ad1ae" ON "profile" ("ownerUserId", "deletedAt", "createdAt", "status") ')
    await queryRunner.query('CREATE TABLE "user" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "email" character varying, "username" character varying, "isEmailConfirmed" boolean NOT NULL DEFAULT false, "confirmEmailToken" character varying, "confirmEmailTokenExpiresAt" TIMESTAMP, "avatarURL" character varying, "referralId" character varying NOT NULL, "referredBy" character varying, "preferences" json NOT NULL DEFAULT \'{"bidActivityNotifications":true,"priceChangeNotifications":true,"outbidNotifications":true,"purchaseSuccessNotifications":true,"promotionalNotifications":true}\', CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "UQ_78a916df40e02a9deb1c4b75edb" UNIQUE ("username"), CONSTRAINT "UQ_4007f003f9899ca1c146097eff9" UNIQUE ("confirmEmailToken"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE INDEX "IDX_ab57b9b261d32985dab1918438" ON "user" ("referralId") ')
    await queryRunner.query('CREATE INDEX "IDX_a05a906b15d53a789c5fc86d69" ON "user" ("confirmEmailToken", "confirmEmailTokenExpiresAt") ')
    await queryRunner.query('CREATE TABLE "wallet" ("id" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userId" character varying NOT NULL, "chainId" character varying NOT NULL, "chainName" character varying NOT NULL, "network" character varying NOT NULL, "address" character varying NOT NULL, CONSTRAINT "PK_bec464dd8d54c39c54fd32e2334" PRIMARY KEY ("id"))')
    await queryRunner.query('CREATE INDEX "IDX_35472b1fe48b6330cd34970956" ON "wallet" ("userId") ')
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_d961f78eb041ecc84687fea35a" ON "wallet" ("chainId", "address", "network") ')
    await queryRunner.query('ALTER TABLE "market_swap" ADD CONSTRAINT "FK_c27294251ee1c5d9c03f95ddf24" FOREIGN KEY ("marketAskId") REFERENCES "market_ask"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
    await queryRunner.query('ALTER TABLE "market_swap" ADD CONSTRAINT "FK_23438b727a123a21411db77ceeb" FOREIGN KEY ("marketBidId") REFERENCES "market_bid"("id") ON DELETE NO ACTION ON UPDATE NO ACTION')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "market_swap" DROP CONSTRAINT "FK_23438b727a123a21411db77ceeb"')
    await queryRunner.query('ALTER TABLE "market_swap" DROP CONSTRAINT "FK_c27294251ee1c5d9c03f95ddf24"')
    await queryRunner.query('DROP INDEX "public"."IDX_d961f78eb041ecc84687fea35a"')
    await queryRunner.query('DROP INDEX "public"."IDX_35472b1fe48b6330cd34970956"')
    await queryRunner.query('DROP TABLE "wallet"')
    await queryRunner.query('DROP INDEX "public"."IDX_a05a906b15d53a789c5fc86d69"')
    await queryRunner.query('DROP INDEX "public"."IDX_ab57b9b261d32985dab1918438"')
    await queryRunner.query('DROP TABLE "user"')
    await queryRunner.query('DROP INDEX "public"."IDX_18a053d630815c9fdba26ad1ae"')
    await queryRunner.query('DROP INDEX "public"."IDX_5fbce8b9bbd1cf934117f492d4"')
    await queryRunner.query('DROP TABLE "profile"')
    await queryRunner.query('DROP TYPE "public"."profile_status_enum"')
    await queryRunner.query('DROP INDEX "public"."IDX_91fa6acf35b7416b33a5ed0b4a"')
    await queryRunner.query('DROP INDEX "public"."IDX_9bdcfe1932d4e6a2d63b6964cb"')
    await queryRunner.query('DROP INDEX "public"."IDX_a985aa636a6d548ee30e68b882"')
    await queryRunner.query('DROP TABLE "nft"')
    await queryRunner.query('DROP TYPE "public"."nft_type_enum"')
    await queryRunner.query('DROP TABLE "market_swap"')
    await queryRunner.query('DROP TABLE "market_bid"')
    await queryRunner.query('DROP TYPE "public"."market_bid_auctiontype_enum"')
    await queryRunner.query('DROP TABLE "market_ask"')
    await queryRunner.query('DROP TYPE "public"."market_ask_auctiontype_enum"')
    await queryRunner.query('DROP TABLE "event"')
    await queryRunner.query('DROP INDEX "public"."IDX_6daf260f04aad49c0e164fe8ac"')
    await queryRunner.query('DROP INDEX "public"."IDX_3447756fead163cc28da29f50b"')
    await queryRunner.query('DROP INDEX "public"."IDX_a4db743307da136f0a33734301"')
    await queryRunner.query('DROP INDEX "public"."IDX_4c27707fc3097cd748073acb32"')
    await queryRunner.query('DROP INDEX "public"."IDX_cff1a3063eecfa8690eb323b7d"')
    await queryRunner.query('DROP INDEX "public"."IDX_0782d1067dcf4c7496e49a8142"')
    await queryRunner.query('DROP INDEX "public"."IDX_6d05b97f6bd418e7349581ce79"')
    await queryRunner.query('DROP TABLE "edge"')
    await queryRunner.query('DROP TYPE "public"."edge_edgetype_enum"')
    await queryRunner.query('DROP TYPE "public"."edge_thatentitytype_enum"')
    await queryRunner.query('DROP TYPE "public"."edge_thisentitytype_enum"')
    await queryRunner.query('DROP INDEX "public"."IDX_2d96271c65f68abee85b67a850"')
    await queryRunner.query('DROP TABLE "curation"')
    await queryRunner.query('DROP INDEX "public"."IDX_e814aff6539600dfcc88af41fc"')
    await queryRunner.query('DROP TABLE "collection"')
    await queryRunner.query('DROP INDEX "public"."IDX_2ce892175f30a263d7f2a48890"')
    await queryRunner.query('DROP INDEX "public"."IDX_7bb009c7c40c5efdd372061dc4"')
    await queryRunner.query('DROP INDEX "public"."IDX_fcf688e53309f9b15699258fb7"')
    await queryRunner.query('DROP INDEX "public"."IDX_8d22ddaf5542c385971071de14"')
    await queryRunner.query('DROP INDEX "public"."IDX_e5fe9523948edab80df1cb14ea"')
    await queryRunner.query('DROP INDEX "public"."IDX_b0f254bd6d29d3da2b6a8af262"')
    await queryRunner.query('DROP INDEX "public"."IDX_8898792509b9d174c32d5f10ed"')
    await queryRunner.query('DROP TABLE "bid"')
    await queryRunner.query('DROP TYPE "public"."bid_status_enum"')
    await queryRunner.query('DROP TYPE "public"."bid_nfttype_enum"')
    await queryRunner.query('DROP INDEX "public"."IDX_2ca1849f697a2a1eda435863fa"')
    await queryRunner.query('DROP INDEX "public"."IDX_f72b9f75117746878f7b44012e"')
    await queryRunner.query('DROP TABLE "approval"')
  }

}
