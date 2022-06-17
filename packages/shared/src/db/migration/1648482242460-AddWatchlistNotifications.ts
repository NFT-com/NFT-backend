import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWatchlistNotifications1648482242460 implements MigrationInterface {

  name = 'AddWatchlistNotifications1648482242460'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user" ALTER COLUMN "preferences" SET DEFAULT \'{"bidActivityNotifications":true,"priceChangeNotifications":true,"outbidNotifications":true,"purchaseSuccessNotifications":true,"promotionalNotifications":true,"nftSoldNotifications":true,"nftListingChangeNotifications":true,"nftOwnerChangeNotifications":true,"nftNewBidNotifications":true,"collectionFloorChangeNotifications":true,"collectionAssetSoldNotifications":true,"collectionNewListingNotifications":true}\'')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user" ALTER COLUMN "preferences" SET DEFAULT \'{"bidActivityNotifications":true,"priceChangeNotifications":true,"outbidNotifications":true,"purchaseSuccessNotifications":true,"promotionalNotifications":true}\'')
  }

}
