const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const watchList = new Schema({
  address: { type: String },
  uri: { type: String }
});

module.exports = mongoose.model("WatchList", watchList);
