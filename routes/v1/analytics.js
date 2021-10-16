const express = require("express");
const analyticsController = require(__dirname +
  "/../../controllers/analytics.js");

const analyticsRouter = express.Router();

// cron to pull latest eth transaction

analyticsRouter.get("/", analyticsController.getAnalytics);
analyticsRouter.get("/tvl", analyticsController.getTVL);
analyticsRouter.get("/sync", analyticsController.syncTVL);
analyticsRouter.get("/getPrice", analyticsController.getCreatorCoinPrice);
analyticsRouter.get("/profileStats", analyticsController.getNftProfileStat);

analyticsRouter.get("/sortedBids/:uri", analyticsController.getSortedBids);

analyticsRouter.get("/isOwner", analyticsController.isOwner);

analyticsRouter.post("/watchlist", analyticsController.watchlist);
analyticsRouter.post("/recordPageView", analyticsController.recordPageView);
analyticsRouter.post("/dismissBid", analyticsController.dismissBid);

analyticsRouter.get(
  "/getProfileDetails/:uri",
  analyticsController.getProfileDetails
);

analyticsRouter.get(
  "/individualBids/:address",
  analyticsController.getIndividualBids
);

analyticsRouter.get(
  "/nftPermit/:address",
  analyticsController.getAllowancePermit
);

analyticsRouter.get("/watchlist/:address", analyticsController.getWatchList);

analyticsRouter.get(
  "/viewsWatching/:uri",
  analyticsController.getViewsWatching
);

analyticsRouter.get(
  "/individualAccounts/:address",
  analyticsController.getIndividualAccounts
);

module.exports = analyticsRouter;
