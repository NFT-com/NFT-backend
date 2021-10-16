const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// wallets are unique users who have interacted with NFT.com
// watching or submitting bids
const wallets = new Schema({
  ethereumAddress: { type: Number },
  watching: [{ type: "String " }]
});

module.exports = mongoose.model("Wallets", wallets);
