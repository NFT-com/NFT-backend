const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const accounts = new Schema({
  userAddress: { type: String }, // Ethereum Address
  referredBy: { type: String }, // Ethereum Address
  emailAddress: { type: String }, // email of userAddress
  verifiedEmail: { type: Boolean, default: false },
  authenticateCode: { type: Number }, // 4 digit code used to verify ownership of email
  createdAt: { type: Date },
  updatedAt: { type: Date }
});

accounts.pre("save", function(next) {
  const date = new Date();
  this.updatedAt = date;
  if (!this.createdAt) {
    this.createdAt = date;
  }
  next();
});

module.exports = mongoose.model("Accounts", accounts);
