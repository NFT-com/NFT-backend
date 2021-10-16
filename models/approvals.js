const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BigNumber = require("bignumber.js");
const BigNumberSchema = require("mongoose-bignumber");

const approvals = new Schema({
  owner: { type: String },
  spender: { type: String },
  value: { type: String }, // hex value
  nonce: { type: Number },
  txHash: { type: String },
  status: { type: String },
  deadline: { type: String }, // hex value
  v: { type: String },
  r: { type: String },
  s: { type: String }
});

module.exports = mongoose.model("Approvals", approvals);
