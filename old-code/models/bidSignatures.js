const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const mongooseAlgolia = require("mongoose-algolia");

const BigNumber = require("bignumber.js");
const BigNumberSchema = require("mongoose-bignumber");

const bidSignatures = new Schema({
  _timeCreated: { type: Number }, // unix timestamp
  _timeUpdated: { type: Number }, // unix last update (used to calculate latest stakeWeight + _stakeWeightedSeconds)
  _stakeWeightedSeconds: { type: Number }, // seconds x nft tokens staked up until _timeUpdated
  _owner: { type: String },
  _profileURI: { type: String },
  _nftTokens: { type: String }, // hex value
  txHash: { type: String },
  status: { type: String },
  dismissed: { type: Boolean },
  v: { type: String },
  r: { type: String },
  s: { type: String }
});

bidSignatures.plugin(mongooseAlgolia, {
  appId: process.env.ALGOLIA_APP_ID,
  apiKey: process.env.ALGOLIA_API_KEY,
  debug: true,
  indexName: function(doc) {
    return `bid_${process.env.NODE_ENV}`;
  }
});

module.exports = mongoose.model("BidSignatures", bidSignatures);
