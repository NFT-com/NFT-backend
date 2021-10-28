const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const gallery = new Schema({
  owner: { type: String },
  account: { type: String },
  uri: { type: String },
  contractAddress: { type: String },
  tokenId: { type: Number },
  uriData: { type: Object },
  name: { type: String },
  description: { type: String },
  image: { type: String }
});

module.exports = mongoose.model("Gallery", gallery);
