const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const views = new Schema({
  profileURI: { type: String },
  views: { type: Number }
});

module.exports = mongoose.model("Views", views);
