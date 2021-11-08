const URI = require(__dirname + "/../models/uri");
const Bids = require(__dirname + "/../models/bids");
const Approvals = require(__dirname + "/../models/approvals");
const BidSignatures = require(__dirname + "/../models/bidSignatures");
const { BigNumber } = require("@ethersproject/bignumber");
const sgMail = require("@sendgrid/mail");
const ethers = require("ethers");
sgMail.setApiKey(process.env.SG_API_KEY);
const { sort } = require("fast-sort");
const chalk = require("chalk");
const crypto = require("crypto");
const cache = require("memory-cache");
const { getContract, getABI, getAddress } = require("../httpHooks");
const { provider } = require("../provider");
const algoliasearch = require("algoliasearch");

const client = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_API_KEY
);

const bidIndex = client.initIndex(`bid_${process.env.NODE_ENV}`);

bidIndex.setSettings({
  searchableAttributes: ["_profileURI", "_owner", "txHash"],
  attributesToHighlight: ["_profileURI", "_owner", "txHash"]
});

const isSandbox = chainId => {
  switch (Number(chainId)) {
    case 1:
      return false;
    default:
      return true;
  }
};

const isProduction = chainId => {
  return !isSandbox(chainId);
};

exports.getURI = async (req, res, next) => {
  try {
    let { uri } = req.params;

    let key = `${uri}-getURI`;
    let val = cache.get(key);

    if (val) {
      return res.json(val);
    } else {
      let result = await URI.findOne({
        profileName: uri?.toLowerCase()
      }).exec();

      if (result) {
        cache.put(key, result.metadata, 1000 * 60); // 60 seconds
        return res.json(result.metadata);
      } else {
        return res.status(400).json({
          message: "NFT.com profile not found"
        });
      }
    }
  } catch (err) {
    console.log("error: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

// decrypt approval
exports.storeApproval = async (req, res, next) => {
  try {
    let { owner, spender, value, nonce, deadline, v, r, s } = req.body;
    const passedInSignature = req.headers["signature"];

    console.log(chalk.magenta(`new approval: ${owner}, ${value}`));
    console.log(chalk.magenta(`passedInSignature: ${passedInSignature}`));

    var hmac = crypto.createHmac("sha256", process.env.CLIENT_SECRET);
    var calculatedSignature = hmac
      .update(
        `${owner.toLowerCase()}_${spender.toLowerCase()}_${nonce}_${v}_${r.toLowerCase()}_${s.toLowerCase()}`
      )
      .digest("hex");

    if (calculatedSignature === passedInSignature) {
      let foundApproval = await Approvals.findOne({
        owner: owner.toLowerCase(),
        spender: spender.toLowerCase(),
        value: value._hex,
        nonce,
        deadline: deadline._hex,
        v,
        r,
        s
      }).exec();

      if (foundApproval) {
        return res.status(400).json({
          message: "already exists"
        });
      } else {
        let newApproval = await Approvals.create({
          owner: owner.toLowerCase(),
          spender: spender.toLowerCase(),
          value: value._hex,
          nonce,
          deadline: deadline._hex,
          v,
          r,
          s
        });

        console.log(chalk.green(`new approval item: ${newApproval._id}`));

        return res.json({
          message: "success"
        });
      }
    } else {
      return res.status(400).json({
        message: "invalid auth"
      });
    }
  } catch (err) {
    console.log("error: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.getBid = async (req, res, next) => {
  try {
    let { key } = req.params;
    let _owner = key.split("-")[0];
    let _profileURI = key.split("-")[1];

    const passedInSignature = req.headers["signature"];

    var hmac = crypto.createHmac("sha256", process.env.CLIENT_SECRET);
    var calculatedSignature = hmac
      .update(`${_owner.toLowerCase()}-${_profileURI.toLowerCase()}`)
      .digest("hex");

    if (calculatedSignature === passedInSignature && _owner && _profileURI) {
      let bids = await BidSignatures.find({
        _owner,
        _profileURI
      }).exec();

      let sortedBids = sort(bids).desc(r => Number(r._nftTokens));
      let topBid = sortedBids[0];

      return res.json({
        bid: topBid
      });
    } else {
      return res.status(400).json({
        message: "invalid auth"
      });
    }
  } catch (err) {
    console.log("error: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.cancelBid = async (req, res, next) => {
  try {
    let { _owner, _profileURI } = req.body;

    const passedInSignature = req.headers["signature"];

    var hmac = crypto.createHmac("sha256", process.env.CLIENT_SECRET);
    var calculatedSignature = hmac
      .update(`${_owner.toLowerCase()}_${_profileURI.toLowerCase()}`)
      .digest("hex");

    if (calculatedSignature === passedInSignature && _owner && _profileURI) {
      let bids = await BidSignatures.find({
        _owner: _owner.toLowerCase(),
        _profileURI: _profileURI.toLowerCase()
      }).exec();

      for (let i = 0; i < bids.length; i++) {
        await bids[i].delete();
      }

      return res.json({
        message: "success"
      });
    } else {
      return res.status(400).json({
        message: "invalid auth"
      });
    }
  } catch (err) {
    console.log("error: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

const formatSearchObject = async (results, type) => {
  try {
    let returnArray = [];
    let object = results[0].hits;

    for (var i = 0; i < object.length; i++) {
      let hit = object[i];

      switch (type) {
        case "bid":
          let userObject = {
            type: type,
            _owner: hit._owner,
            _profileURI: hit._profileURI,
            _nftTokens: hit._nftTokens,
            _id: hit.objectID
          };

          if (hit._highlightResult._profileURI.matchLevel === "full") {
            userObject.label = hit._highlightResult._profileURI.value;
            returnArray.push(userObject);
          }

          if (hit._highlightResult._owner.matchLevel === "full") {
            userObject.label = hit._highlightResult._owner.value;
            returnArray.push(userObject);
          }

          break;
        default:
          break;
      }
    }

    return returnArray;
  } catch (err) {
    console.log("error: ", err);
  }
};

exports.search = async (req, res, next) => {
  try {
    let { query } = req.params;

    if (query === "") {
      return res.send([]);
    }

    let allResults = [];
    let hitsPromise = new Promise(() => {
      let hits = await bidIndex.search(query);
      let bidResults = await formatSearchObject(hits, "bid");
      allResults = allResults.concat(bidResults);  
    });
    let facetsPromise = new Promise(() => {
      let facetHits = await bidIndex.searchForFacetValues("_profileURI", query)
      let facetResults = await formatSearchObject(facetHits, "bid");
      allResults = allResults.concat(facetResults);
    })

    await Promise.all([hitsPromise, facetsPromise]);

    
    return res.json({
      hits: bidResults
    });
  } catch (err) {
    console.log("error: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

// decrypt bid
exports.storeBid = async (req, res, next) => {
  try {
    let {
      _nftTokens,
      _profileURI,
      _owner,
      creationTime,
      lastUpdateTime,
      existingStake,
      existingStakeWeight,
      v,
      r,
      s
    } = req.body;
    const passedInSignature = req.headers["signature"];

    var hmac = crypto.createHmac("sha256", process.env.CLIENT_SECRET);
    var calculatedSignature = hmac
      .update(
        `${_profileURI.toLowerCase()}_${_owner.toLowerCase()}_${v}_${r.toLowerCase()}_${s.toLowerCase()}`
      )
      .digest("hex");

    console.log("passed in HEX _nftTokens: ", _nftTokens);
    console.log("big number parse: ", _nftTokens._hex);

    if (calculatedSignature === passedInSignature) {
      let foundBid = await BidSignatures.findOne({
        _nftTokens: _nftTokens._hex,
        _profileURI: _profileURI.toLowerCase(),
        _owner: _owner.toLowerCase(),
        v,
        r,
        s
      }).exec();

      if (foundBid) {
        return res.status(400).json({
          message: "already exists"
        });
      } else {
        let currentTime = new Date().getTime();
        let seconds =
          currentTime -
          (lastUpdateTime && currentTime > lastUpdateTime
            ? lastUpdateTime
            : currentTime);
        console.log("seconds: ", seconds);

        let latestStakeWeightSeconds =
          seconds *
          (existingStake
            ? Number(
                BigNumber.from(existingStake).div(BigNumber.from(10).pow(18))
              )
            : 0);

        console.log("existingStake: ", existingStake);
        console.log("latestStakeWeightSeconds: ", latestStakeWeightSeconds);
        let currentStakeWeightSeconds =
          (existingStakeWeight ?? 0) + latestStakeWeightSeconds;

        console.log("currentStakeWeightSeconds: ", currentStakeWeightSeconds);

        let newBid = await BidSignatures.create({
          _timeCreated: creationTime ?? currentTime,
          _timeUpdated: currentTime,
          _stakeWeightedSeconds: currentStakeWeightSeconds,
          _nftTokens: _nftTokens._hex,
          _profileURI: _profileURI.toLowerCase(),
          _owner: _owner.toLowerCase(),
          v,
          r,
          s
        });

        console.log(chalk.green(`new bid item: ${newBid._id}`));

        return res.json({
          message: "success"
        });
      }
    } else {
      return res.status(400).json({
        message: "invalid auth"
      });
    }
  } catch (err) {
    console.log("error: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

async function testPermit() {
  try {
    let approval = await Approvals.findOne({
      txHash: undefined
    }).exec();

    if (!approval) {
      console.log(chalk.red("no more approvals to test!"));
      return;
    }

    var wallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC);

    const p = isProduction(process.env.CHAIN_ID);

    wallet = wallet.connect(provider(p));

    const nftContract = new ethers.Contract(
      getAddress("nft", process.env.CHAIN_ID),
      getABI("nft", process.env.CHAIN_ID),
      wallet
    );

    let overrides = {
      // The maximum units of gas for the transaction to use
      gasLimit: 1500000,
      gasPrice: Number(10) * 1000000000 // wei
    };

    console.log(chalk.green("initiated permit tx 1/2"));

    let tx = await nftContract.permit(
      approval.owner,
      approval.spender,
      BigNumber.from(2)
        .pow(256)
        .sub(1),
      BigNumber.from(2)
        .pow(256)
        .sub(1),
      approval.v,
      approval.r,
      approval.s,
      overrides
    );

    var hash = tx.hash;

    approval.txHash = hash;

    console.log(chalk.green("initiated permit tx 2/2"));
    provider(p)
      .waitForTransaction(hash)
      .then(async receipt => {
        if (receipt.status === 1) {
          // success
          // update the backend DB
          console.log(chalk.green("successful permit!"));

          approval.status = "success";
          await approval.save();
        } else {
          console.log("====> permit error. receipt: ", receipt);

          approval.status = "failed";
          await approval.save();
        }
      });
  } catch (err) {
    console.log("test: ", err);
  }
}

async function mintFor(user, profile) {
  try {
    let bids = await BidSignatures.find({
      _owner: user.toLowerCase(),
      _profileURI: profile.toLowerCase()
    }).exec();

    let sortedBids = sort(bids).desc(r => Number(r._nftTokens));

    console.log("sortedBids: ", sortedBids);
    let topBid = sortedBids[0];

    if (!topBid) {
      console.log(chalk.red(`top bid doesn't exist`));
      return;
    }

    let nftTokenContract = await getContract("nft");
    let allowance = await nftTokenContract.allowance(
      user.toLowerCase(),
      await getAddress("profileAuction")
    );

    let approval = await Approvals.findOne({
      owner: user.toLowerCase()
    }).exec();

    if (!approval) {
      console.log(`approval not found: ${user}`);
    } else {
      if (
        BigNumber.from(approval.value).lt(BigNumber.from(topBid._nftTokens))
      ) {
        console.log(
          `approved value is less than bid: approved amount = ${Number(
            approval.value
          )}, bid amount = ${Number(topBid._nftTokens)}`
        );
      } else {
        var wallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC);

        const p = isProduction(process.env.CHAIN_ID);

        wallet = wallet.connect(provider(p));

        const profileAuctionContract = new ethers.Contract(
          getAddress("profileAuction", process.env.CHAIN_ID),
          getABI("profileAuction", process.env.CHAIN_ID),
          wallet
        );

        let overrides = {
          // The maximum units of gas for the transaction to use
          gasLimit: 1500000,
          gasPrice: Number(10) * 1000000000 // wei
        };

        console.log(chalk.green("initiated mint tx 1/2"));

        let tx = await profileAuctionContract.mintProfileFor(
          topBid._nftTokens,
          topBid._profileURI,
          topBid._owner,
          topBid.v,
          topBid.r,
          topBid.s,
          approval.v,
          approval.r,
          approval.s,
          overrides
        );

        var hash = tx.hash;

        topBid.txHash = hash;

        console.log(chalk.green("initiated mint tx 2/2"));
        provider(p)
          .waitForTransaction(hash)
          .then(async receipt => {
            if (receipt.status === 1) {
              // success
              // update the backend DB
              console.log(chalk.green("successful mint!"));

              topBid.status = "success";
              await topBid.save();
            } else {
              console.log("permit error. receipt: ", receipt);
              topBid.status = "failed";
              await topBid.save();
            }
          });
      }
    }
  } catch (err) {
    console.log("mint error: ", err);
  }
}

// testPermit();

// mintFor('0x0f33d6F1d69f87E5494cBfCAC9B9A3619f38Ca09', 'toby2');
