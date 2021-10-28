// eslint-disable
const express = require("express");
const userRouter = express.Router();
const userController = require(__dirname + "/../../controllers/user");
const AWS = require("aws-sdk");
const { uploadAuth, emailAuth, userAddressAuth } = require(__dirname +
  "/../../middleware/uploadAuth");
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
});
const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");

const BUCKET_NAME = "nft-com/user";
const rateLimit = require("express-rate-limit");
const cache = require("memory-cache");

function generateHash(user) {
  let username = user.profileURI;
  let version = (user.profileVersion || 0) + 1; // 0 is default
  const secret = "nft_com";
  const hash = require("crypto")
    .createHmac("sha256", secret)
    .update(username.toLowerCase())
    .digest("hex");

  return `${hash}?ver=${version}`;
}

function generateHashHeader(user) {
  let username = user.profileURI;
  let version = (user.headerVersion || 0) + 1; // 0 is default
  let currentDate = new Date().toString();
  const secret = "nft_com";
  const hash = require("crypto")
    .createHmac("sha256", secret)
    .update(username.toLowerCase() + currentDate)
    .digest("hex");

  return `headers/${hash}?ver=${version}`;
}

var upload = multer({
  fileFilter: function(req, file, cb) {
    var filetypes = /jpeg|jpg|png|svg|gif/;
    var mimetype = filetypes.test(file.mimetype);
    var extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(
      "Error: File upload only supports the following filetypes - " + filetypes
    );
  },
  storage: multerS3({
    s3: s3,
    bucket: BUCKET_NAME,
    acl: "public-read",
    contentType: function(req, file, cb) {
      cb(null, file.mimetype);
    },
    key: function(req, file, cb) {
      if (file.fieldname === "image") {
        cb(null, generateHash(req.user));
      } else if (file.fieldname === "header") {
        cb(null, generateHashHeader(req.user));
      }
    }
  })
});

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100000
});

userRouter.get("/test", userController.test);

userRouter.put(
  "/updateProfile",
  uploadAuth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "header", maxCount: 1 }
  ]),
  userController.updateProfile
);

userRouter.get("/getUser/:username", userController.getUser);
userRouter.post("/addNFT", userController.addNFT);
userRouter.post("/addUser", emailAuth, userController.addUser);
userRouter.post("/verifyUser", emailAuth, userController.verifyUser);
userRouter.get("/getUser", userAddressAuth, userController.getUserAccount);
userRouter.get("/getNFTs", userController.getEtherScanNFTs);
userRouter.get("/getGallery/:account", userController.getGallery);

module.exports = userRouter;
