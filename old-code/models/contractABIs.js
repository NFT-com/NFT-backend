const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const contractABI = new Schema({
  contractAddress: { type: String },
  implementation: { type: String },
  ABI: { type: String }
});

module.exports = mongoose.model("ContractABI", contractABI);
