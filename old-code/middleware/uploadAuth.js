const User = require(__dirname + "/../models/users");
const crypto = require("crypto");

const uploadAuth = async (req, res, next) => {
  const { username } = req.query;

  const passedInSignature = req.headers["signature"];

  var hmac = crypto.createHmac("sha256", process.env.CLIENT_SECRET);
  var calculatedSignature = hmac
    .update(`${username.toLowerCase()}`)
    .digest("hex");

  if (calculatedSignature === passedInSignature) {
    let foundUser = await User.findOne({
      profileURI: username?.toLowerCase()
    }).exec();

    if (!foundUser) {
      return res.status(401).json({
        message: "invalid profile"
      });
    } else {
      req.user = foundUser;
      next();
    }
  } else {
    return res.status(400).json({
      message: "invalid auth"
    });
  }
};

const emailAuth = async (req, res, next) => {
  const { emailAddress } = req.body;

  const passedInSignature = req.headers["signature"];

  var hmac = crypto.createHmac("sha256", process.env.CLIENT_SECRET);
  var calculatedSignature = hmac
    .update(`${emailAddress.toLowerCase()}`)
    .digest("hex");

  if (calculatedSignature === passedInSignature) {
    next();
  } else {
    return res.status(400).json({
      message: "invalid auth"
    });
  }
};

const userAddressAuth = async (req, res, next) => {
  const { userAddress } = req.query;

  const passedInSignature = req.headers["signature"];

  var hmac = crypto.createHmac("sha256", process.env.CLIENT_SECRET);
  var calculatedSignature = hmac
    .update(`${userAddress.toLowerCase()}`)
    .digest("hex");

  if (calculatedSignature === passedInSignature) {
    next();
  } else {
    return res.status(400).json({
      message: "invalid auth"
    });
  }
};

module.exports = { uploadAuth, emailAuth, userAddressAuth };
