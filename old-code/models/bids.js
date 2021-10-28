const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bids = new Schema({
  user: { type: String },
  txHash: { type: String },
  profileURI: { type: String },
  nftToken: { type: String },
  postAdd: { type: Number },
  event: { type: String },
  blockNumber: { type: Number }
});

module.exports = mongoose.model("Bids", bids);
