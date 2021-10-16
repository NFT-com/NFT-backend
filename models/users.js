const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const users = new Schema({
  profileURI: { type: String },
  user: { type: String },
  nftTokenStaked: { type: String },
  blockMinted: { type: Number },
  txHash: { type: String },
  headerURL: { type: String },
  profileURL: { type: String },
  headerVersion: { type: Number },
  profileVersion: { type: Number }
});

module.exports = mongoose.model("Users", users);
