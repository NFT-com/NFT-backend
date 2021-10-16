const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const uri = new Schema({
  tokenId: { type: Number },
  profileName: { type: String },
  metadata: {
    title: { type: String },
    name: { type: String },
    description: { type: String },
    image: {
      type: String,
      default: "https://nft-com.s3.us-east-2.amazonaws.com/default_user.svg"
    },
    external_url: { type: String }
  }
});

module.exports = mongoose.model("URI", uri);
