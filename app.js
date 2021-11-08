const express = require("express");
require("dotenv").config();
const mongoose = require("mongoose");
const expressValidator = require("express-validator");
const chalk = require("chalk");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const cookieParser = require("cookie-parser");
const { ws } = require("./websocket");
const config = require("./config");

const limiter = rateLimit({
  max: 100000, // max requests
  windowMs: 60 * 60 * 1000, // 1 Hour of 'ban' / lockout
  message: "Too many requests" // message to send
});

const app = express();

app.use(xss());
app.use(mongoSanitize());
app.use(limiter);
app.use(expressValidator());
app.use(helmet());
app.use(express.json({ limit: "50mb" }));
app.use(
  express.urlencoded({
    limit: "50mb",
    extended: true,
    parameterLimit: 1000000
  })
);
// app.use(upload.array());
app.use(express.static("public"));

const production = process.env.NODE_ENV === "PRODUCTION";
const DB_URL = production
  ? process.env.DB_URI
  : `mongodb://${config.db.username}:${config.db.password}@${config.db.host}:${config.db.port}`;

mongoose
  .connect(DB_URL, {
    useNewUrlParser: true,
    autoCreate: true,
    autoIndex: true,
    useFindAndModify: false,
    dbName: config.db.database
  })
  .then(
    () => {
      console.log(`Database connected with ${DB_URL}/${config.db.database}`);
    },
    err => {
      console.log("ERROR DB: ", err);
    }
  );

const mainV1 = require("./routes/v1/main");
const usersV1 = require("./routes/v1/users");
const analyticsV1 = require("./routes/v1/analytics");

const corsConfig = {
  origin: true,
  credentials: true
};

app.options("*", cors(corsConfig));
app.use(cors(corsConfig));

app.use(cookieParser());

app.use("", mainV1);
app.use("/user", usersV1);
app.use("/analytics", analyticsV1);

app.use(function(req, res, next) {
  if (!req.route) return res.status(404).json({ error: "404 Route Not Found" });
  next();
});

const server = require("http").createServer(app);

server.listen(config.serverPort);

function print(path, layer) {
  if (layer.route) {
    layer.route.stack.forEach(
      print.bind(null, path.concat(split(layer.route.path)))
    );
  } else if (layer.name === "router" && layer.handle.stack) {
    layer.handle.stack.forEach(
      print.bind(null, path.concat(split(layer.regexp)))
    );
  } else if (layer.method) {
    console.log(
      "%s /%s",
      layer.method.toUpperCase(),
      chalk.green(
        path
          .concat(split(layer.regexp))
          .filter(Boolean)
          .join("/")
      )
    );
  }
}

function split(thing) {
  if (typeof thing === "string") {
    return thing.split("/");
  } else if (thing.fast_slash) {
    return "";
  } else {
    var match = thing
      .toString()
      .replace("\\/?", "")
      .replace("(?=\\/|$)", "$")
      .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//);
    return match
      ? match[1].replace(/\\(.)/g, "$1").split("/")
      : "<complex:" + thing.toString() + ">";
  }
}

app._router.stack.forEach(print.bind(null, []));

module.exports = app;
