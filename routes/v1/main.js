const express = require("express");
const mainRouter = express.Router();
const mainController = require(__dirname + "/../../controllers/main.js");

const production = process.env.NODE_ENV === "PRODUCTION";

mainRouter.get("/", async function(req, res) {
  let ipAddr = req.headers["x-forwarded-for"];
  if (ipAddr) {
    let list = ipAddr.split(",");
    ipAddr = list[list.length - 1];
  } else {
    ipAddr = req.connection.remoteAddress;
  }

  return res.send(`NFT.com ${production ? "🌕" : "🌘"}, ip: ${ipAddr}`);
});

mainRouter.get("/uri/:uri", mainController.getURI);

mainRouter.get("/query/:query", mainController.search);

mainRouter.post("/sig/approval", mainController.storeApproval);
mainRouter.post("/sig/bid", mainController.storeBid);
mainRouter.post("/sig/cancelBid", mainController.cancelBid);
mainRouter.get("/sig/:key", mainController.getBid);

module.exports = mainRouter;
