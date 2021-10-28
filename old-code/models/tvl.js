const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const tvl = new Schema({
  rate: { type: Number },
  timestamp: { type: Number }
});

module.exports = mongoose.model("TVL", tvl);
