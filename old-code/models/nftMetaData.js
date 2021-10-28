const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const nftMetaData = new Schema({
  tokenURI: { type: String },
  contractAddress: { type: String },
  imageURL: { type: String },
  tokenId: { type: Number },
  description: { type: String },
  name: { type: String },
  type: { type: Number }, // 721, 1155, etc
  symbol: { type: String },
  createdAt: { type: Date },
  updatedAt: { type: Date }
});

nftMetaData.pre("save", function(next) {
  const date = new Date();
  this.updatedAt = date;
  if (!this.createdAt) {
    this.createdAt = date;
  }
  next();
});

module.exports = mongoose.model("NftMetaData", nftMetaData);
