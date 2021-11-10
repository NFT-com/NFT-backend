const TVL = require(__dirname + "/../models/tvl");
const Views = require(__dirname + "/../models/views");
const Bids = require(__dirname + "/../models/bids");
const URI = require(__dirname + "/../models/uri");
const BidSignatures = require(__dirname + "/../models/bidSignatures");
const Approvals = require(__dirname + "/../models/approvals");
const WatchList = require(__dirname + "/../models/watchList");
const { ethers } = require("ethers");
const sgMail = require("@sendgrid/mail");
const crypto = require("crypto");
const { provider } = require("../provider");
sgMail.setApiKey(process.env.SG_API_KEY);
const { sort } = require("fast-sort");
const { BigNumber } = require("@ethersproject/bignumber");
const cache = require("memory-cache");
const axios = require("axios");
const { getContract, getAddress, getABI } = require("../httpHooks");
const { clearCache } = require("mustache");
const { nftProfile } = require("../config");

const refreshLeaderboard = async () => {
  let bids = await BidSignatures.find({}).exec(); // sort bids based on execution

  let sortedBids = sort(bids).desc(r => Number(r._nftTokens));

  let uniqueBids = [];
  let seenBids = {};
  for (let i = 0; i < sortedBids.length; i++) {
    let curr = sortedBids[i];
    let key = `${curr._owner}_${curr._profileURI}`;

    if (!seenBids[key]) {
      uniqueBids.push(curr);
      seenBids[key] = true;
    }
  }

  let parsedBids = [];
  for (let i = 0; i < uniqueBids.length; i++) {
    let curr = uniqueBids[i];

    if (!curr.dismissed) {
      parsedBids.push({
        _id: uniqueBids[i]._id,
        _timeCreated: curr._timeCreated,
        _timeUpdated: curr._timeUpdated,
        _stakeWeightedSeconds: curr._stakeWeightedSeconds,
        _nftTokens: curr._nftTokens,
        _profileURI: curr._profileURI,
        _owner: curr._owner,
        status: curr.status,
        v: curr.v,
        r: curr.r,
        s: curr.s,
        __v: 0
      });
    }
  }

  return {
    bids: parsedBids
  };
};

const getMintedProfiles = async () => {
  let nftProfileContract = await getContract(
    "nftProfile",
    process.env.CHAIN_ID
  );

  let totalSupply = await nftProfileContract.totalSupply();

  let profiles = [];
  for (let i = 0; i < Number(totalSupply); i++) {
    let details = await nftProfileContract.profileDetails(i);
    let timestamp = await getTimestamp(details[1]._hex);
    let owner = await nftProfileContract.ownerOf(i);
    let foundURI = await URI.findOne({
      profileName: details?.[2]
    }).exec();

    profiles.push({
      photo: foundURI?.metadata?.image,
      details,
      owner: owner.toLowerCase(),
      timestamp
    });
  }

  return profiles;
};

exports.getAllowancePermit = async (req, res, next) => {
  try {
    let { address } = req.params;

    let approval = await Approvals.findOne({
      owner: address?.toLowerCase()
    }).exec();

    if (!approval) {
      return res.json({
        status: 0
      });
    } else {
      return res.json({
        status: 1
      });
    }
  } catch (err) {
    console.log("error get allowance permit: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.recordPageView = async (req, res, next) => {
  try {
    let { uri } = req.body;
    const passedInSignature = req.headers["signature"];

    var hmac = crypto.createHmac("sha256", process.env.CLIENT_SECRET);
    var calculatedSignature = hmac.update(`${uri}`).digest("hex");

    if (calculatedSignature === passedInSignature) {
      await recordView(uri);
      return res.json({
        message: "logged!"
      });
    } else {
      return res.status(400).json({
        message: "unauthorized"
      });
    }
  } catch (err) {
    console.log("error recordView: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.watchlist = async (req, res, next) => {
  try {
    let { uri, account, action } = req.body;
    const passedInSignature = req.headers["signature"];

    var hmac = crypto.createHmac("sha256", process.env.CLIENT_SECRET);
    var calculatedSignature = hmac
      .update(`${uri}_${account}_${action}`)
      .digest("hex");

    if (calculatedSignature === passedInSignature) {
      let existingWatch = await WatchList.findOne({
        address: account,
        uri
      }).exec();

      switch (action) {
        case "subscribe":
          if (!existingWatch) {
            WatchList.create({
              address: account,
              uri
            });
          }

          return res.json({
            message: action
          });
        case "unsubscribe":
          existingWatch.delete(); // remove
          return res.json({
            message: action
          });
        default:
          return res.status(400).json({
            message: "action not found"
          });
      }
    } else {
      return res.status(400).json({
        message: "unauthorized"
      });
    }
  } catch (err) {
    console.log("error watchlist: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

const liveNftPrice = async () => {
  return 0.1;
};

const storeCurrentTVL = async () => {
  try {
    let nftTokenContract = await getContract("nft", process.env.CHAIN_ID);
    let nftProfileContract = await getContract(
      "nftProfile",
      process.env.CHAIN_ID
    );

    let profileAuctionAddress = await getAddress(
      "profileAuction",
      process.env.CHAIN_ID
    );

    let totalUSD = 0;
    let stakedProfile = await nftTokenContract.balanceOf(profileAuctionAddress);

    let nftPrice = await liveNftPrice();

    // go through creator coins
    let totalSupply = await nftProfileContract.totalSupply();
    for (let i = 0; i < totalSupply; i++) {
      let creatorCoin = await nftProfileContract.creatorCoin(i);
      if (creatorCoin !== "0x0000000000000000000000000000000000000000") {
        let currStakedNFT = await nftTokenContract.balanceOf(creatorCoin);
        totalUSD += (currStakedNFT * nftPrice) / 10 ** 18;
      }
    }

    totalUSD += (stakedProfile * nftPrice) / 10 ** 18;

    await TVL.create({
      timestamp: new Date().getTime(),
      rate: totalUSD
    });
  } catch (err) {
    console.log("error storing val: ", err);
  }
};

const getCurrentTVL = async () => {
  let nftTokenContract = await getContract("nft", process.env.CHAIN_ID);
  let nftTokenContract2 = await getContract("nft", process.env.CHAIN_ID);

  let nftProfileContract = await getContract(
    "nftProfile",
    process.env.CHAIN_ID
  );

  let nftProfileContract2 = await getContract(
    "nftProfile",
    process.env.CHAIN_ID
  );

  let profileAuctionAddress = await getAddress(
    "profileAuction",
    process.env.CHAIN_ID
  );

  let totalUSD = 0;
  let stakedProfile = await nftTokenContract.balanceOf(profileAuctionAddress);

  let nftPrice = await liveNftPrice();

  // go through creator coins
  let totalSupply = await nftProfileContract.totalSupply();
  for (let i = 0; i < totalSupply; i++) {
    let creatorCoin =
      i % 2 === 0
        ? await nftProfileContract.creatorCoin(i)
        : await nftProfileContract2.creatorCoin(i);
    if (creatorCoin !== "0x0000000000000000000000000000000000000000") {
      let currStakedNFT =
        i % 2 === 0
          ? await nftTokenContract.balanceOf(creatorCoin)
          : await nftTokenContract2.balanceOf(creatorCoin);
      totalUSD += (currStakedNFT * nftPrice) / 10 ** 18;
    }
  }

  totalUSD += (stakedProfile * nftPrice) / 10 ** 18;

  let object = {
    latestDate: new Date().getTime(),
    num: totalUSD
  };

  return object;
};

exports.syncTVL = async (req, res, next) => {
  try {
    await storeCurrentTVL();

    return res.json({ message: "success!" });
  } catch (err) {
    console.log("error syncTVL: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.getTVL = async (req, res, next) => {
  try {
    let key = `nftTVL`;
    let val = cache.get(key);

    if (val) {
      return res.json(val);
    } else {
      let object = await getCurrentTVL();

      cache.put(key, object, 1000 * 15); // save for 15 seconds

      return res.json(object);
    }
  } catch (err) {
    console.log("error getTVL: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

const getHistoricalTVLData = async () => {
  let time = await TVL.find({}).exec();

  return time.length > 0
    ? time
    : [
        {
          timestamp: 1,
          rate: 100
        },
        {
          timestamp: 5,
          rate: 150
        },
        {
          timestamp: 10,
          rate: 120
        }
      ];
};

exports.getCreatorCoinPrice = async (req, res, next) => {
  try {
    let { creatorCoin, mintBool, amount } = req.query;

    let bondingCurve = await getContract("bondingCurve", process.env.CHAIN_ID);

    const result = await bondingCurve.getPrice(
      BigNumber.from(mintBool),
      creatorCoin,
      amount
    );

    let returnObject = {
      result: result._hex
    };

    return res.json(returnObject);
  } catch (err) {
    console.log("error getCreatorCoinPrice: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.getNftProfileStat = async (req, res, next) => {
  try {
    let { tokenId, account, creatorCoin } = req.query;

    if (isNaN(tokenId) || !account || !creatorCoin) {
      return res.status(400).json({
        message: "missing queries for tokenId, account and/or creatorCoin"
      });
    } else {
      let allowance = -1;
      let ownerFee = -1;

      let nftProfile = await getContract("nftProfile", process.env.CHAIN_ID);

      if (creatorCoin !== "0x0000000000000000000000000000000000000000") {
        let nftContract = await getContract("nft", process.env.CHAIN_ID);
        allowance = await nftContract.allowance(
          account,
          await getAddress("nftProfile")
        );

        ownerFee = await nftProfile.getProfileOwnerFee(tokenId);
      }

      const protocolFee = await nftProfile.getProtocolFee();

      let returnObject = {
        protocolFee: protocolFee._hex,
        ownerFee: ownerFee === -1 ? undefined : ownerFee._hex,
        allowance: allowance === -1 ? undefined : allowance._hex
      };

      return res.json(returnObject);
    }
  } catch (err) {
    console.log("nft profile stat: ", err);
    return res.status(400).json({
      message: "error",
      details: err
    });
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    let profileAuctionContract = await getContract(
      "profileAuction",
      process.env.CHAIN_ID
    );

    const blockWait = await profileAuctionContract.blockWait();
    let { bids } = await refreshLeaderboard();

    let mintedProfiles = await getMintedProfiles();

    let takenNames = mintedProfiles.map(i => i.details._profileURI);

    bids = bids.filter(
      i => takenNames.indexOf(i._profileURI.toLowerCase()) == -1
    );

    let returnObject = {
      bids,
      blockWait: blockWait,
      mintedProfiles: mintedProfiles,
      data: await getHistoricalTVLData()
    };

    return res.json(returnObject);
  } catch (err) {
    console.log("error getAnalytics: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

// checks if an account is the owner of a uri profile
const isOwnerHelper = async (account, uri) => {
  try {
    let key = `${uri.toLowerCase()}_${account}_isOwner`;
    let val = cache.get(key);

    if (val) {
      return val;
    } else {
      let nftProfileContract = await getContract(
        "nftProfile",
        process.env.CHAIN_ID
      );

      let tokenId = await nftProfileContract.getTokenId(uri.toLowerCase());
      let owner = await nftProfileContract.ownerOf(tokenId);

      let ownerBool = account.toLowerCase() === owner.toLowerCase();

      let returnObject = { ownerBool, owner };

      cache.put(key, returnObject, 1000 * 60); // half a minute

      return returnObject;
    }
  } catch (err) {
    return false; // if uri doesn't exist as token yet
  }
};

// returns order of a user and uri (current place, total bids)
// these bids are already pre-vetted via (profileAuction.getBids)
// just pass in amount of tokens
// get all bids for that profile (see internal)
// FIXME: this needs to sorted based on time weighted bid, not raw NFT.com tokens
const getBidOrder = async (user, uri, tokens) => {
  let key = `${uri.toLowerCase()}_${user}_${tokens}_getBidOrder`;
  let val = cache.get(key);

  if (val) {
    return val;
  } else {
    let { bids } = await getUniqueBidsForURI(uri);

    let i;
    for (i = 0; i < bids.length; i++) {
      let bid = bids?.[i];
      if (bid?._nftTokens?._hex === tokens?._hex) break;
    }

    let returnObject = {
      place: i + 1,
      totalBids: bids?.length
    };

    cache.put(key, returnObject, 1000 * 60); // save for 1 minute

    return returnObject;
  }
};

// 0 = pending
// 1 = lost if _blockMinted = 0 else must claim
// 2 = lost if _blockMinted = 0 else, should not be here
const getBidStatus = async uri => {
  let key = `${uri.toLowerCase()}_getBidStatus`;
  let val = cache.get(key);

  if (val) {
    return val;
  } else {
    let profileStatus = 0;

    let nftProfileContract = await getContract(
      "nftProfile",
      process.env.CHAIN_ID
    );

    try {
      await nftProfileContract.getTokenId(uri);
      profileStatus = 2;
    } catch (err) {
      let FoundNewClaimableProfile = await Bids.findOne({
        profileURI: uri.toLowerCase(),
        event: "NewClaimableProfile"
      }).exec();

      if (FoundNewClaimableProfile) profileStatus = 1;
    }

    cache.put(key, profileStatus, 1000 * 30); // save for 30 seconds

    return profileStatus;
  }
};

exports.isOwner = async (req, res, next) => {
  try {
    let { account, uri } = req.query;

    let { ownerBool, owner } = await isOwnerHelper(account, uri);

    return res.json({
      result: ownerBool,
      owner
    });
  } catch (err) {
    console.log("error: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

const getTimestamp = async blockNumber => {
  let result = await axios.post(
    `https://${
      process.env.CHAIN_ID === 1 ? "mainnet" : "rinkeby"
    }.infura.io/v3/${process.env.INFURA}`,
    {
      jsonrpc: "2.0",
      method: "eth_getBlockByNumber",
      params: [blockNumber, false],
      id: 1
    },
    {
      header: {
        "Content-Type": "application/json"
      }
    }
  );

  let timestamp = Number(result.data.result.timestamp);

  return timestamp;
};

exports.getViewsWatching = async (req, res, next) => {
  try {
    let { uri } = req.params;

    let { watching } = await getWatching(uri);
    let { views } = await getViews(uri);

    return res.json({
      views: Number(views),
      watching: Number(watching)
    });
  } catch (err) {
    console.log("error getViewsWatching: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.getWatchList = async (req, res, next) => {
  try {
    let { address } = req.params;

    let watchingList = await WatchList.find({
      address: address.toLowerCase()
    }).exec();

    let returnObj = [];

    for (let i = 0; i < watchingList.length; i++) {
      let curr = watchingList[i];

      let { bids, profileStatus } = await getUniqueBidsForURI(curr.uri);

      if (bids[0]) {
        returnObj.push({
          _profileURI: curr.uri,
          profileStatus,
          topBid: bids[0]._nftTokens
        });
      }
    }

    return res.json(returnObj);
  } catch (err) {
    console.log("error getWatchList: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.getIndividualAccounts = async (req, res, next) => {
  try {
    let { address } = req.params;

    if (!address || address === "null" || address == "undefined") {
      return res.status(400).json({
        message: "address not passed in"
      });
    }

    let nftProfileContract = await getContract(
      "nftProfile",
      process.env.CHAIN_ID
    );

    let nftProfileContract2 = await getContract(
      "nftProfile",
      process.env.CHAIN_ID
    );

    let nftProfileContract3 = await getContract(
      "nftProfile",
      process.env.CHAIN_ID
    );

    let nftProfileContract4 = await getContract(
      "nftProfile",
      process.env.CHAIN_ID
    );

    let balance = await nftProfileContract.balanceOf(address);

    let tokenArray = [];

    for (let i = 0; i < balance; i++) {
      let tokenId = await nftProfileContract2.tokenOfOwnerByIndex(address, i);
      let tokenDetails = await nftProfileContract3.profileDetails(tokenId);
      let creatorCoin = await nftProfileContract4.creatorCoin(tokenId);

      let uri = await URI.findOne({
        profileName: tokenDetails[2]
      }).exec();

      let timestamp = await getTimestamp(tokenDetails[1]._hex);

      tokenArray.push({
        tokenId,
        tokenDetails,
        timestamp,
        uriPicture: uri.metadata.image,
        creatorCoin
        // maybe add profileFees
      });
    }

    return res.json({
      tokenArray
    });
  } catch (err) {
    console.log("error getIndividualAccounts: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.dismissBid = async (req, res, next) => {
  try {
    let { _profileURI, _owner } = req.body;
    const passedInSignature = req.headers["signature"];

    var hmac = crypto.createHmac("sha256", process.env.CLIENT_SECRET);
    var calculatedSignature = hmac
      .update(`${_profileURI.toLowerCase()}_${_owner.toLowerCase()}`)
      .digest("hex");

    if (calculatedSignature === passedInSignature) {
      let foundBids = await BidSignatures.find({
        _profileURI: _profileURI.toLowerCase(),
        _owner: _owner.toLowerCase()
      }).exec();

      if (foundBids.length === 0) {
        return res.status(400).json({
          message: "not found"
        });
      } else {
        let sortedBids = sort(foundBids).desc(r => Number(r._nftTokens));
        let foundBid = sortedBids[0];
        foundBid.dismissed = true;
        await foundBid.save();

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
    console.log("dismiss bid error: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.getIndividualBids = async (req, res, next) => {
  try {
    let { address } = req.params;

    if (address && address !== "undefined" && address !== "null") {
      let profileAuctionContract = await getContract(
        "profileAuction",
        process.env.CHAIN_ID
      );

      let profileAuctionContract2 = await getContract(
        "profileAuction",
        process.env.CHAIN_ID
      );

      let profileFee = await profileAuctionContract.profileFee();

      let { bids } = await refreshLeaderboard();

      bids = bids.filter(i => i._owner.toLowerCase() === address.toLowerCase());

      let bidStatusArr = [];
      let bidOrderArr = [];

      for (let i = 0; i < bids.length; i++) {
        let bidStatus = await getBidStatus(bids[i]._profileURI);

        let { place, totalBids } = await getBidOrder(
          address,
          bids[i]._profileURI,
          bids[i]._nftTokens
        );

        bidStatusArr.push(bidStatus);
        bidOrderArr.push({
          place,
          totalBids
        });
      }

      let annotatedBids = await Promise.all(
        bids.map(async (i, index) => {
          let structHash =
            index % 2 === 0
              ? await profileAuctionContract.getStructHash(
                  i._nftTokens ?? BigNumber.from(0),
                  i._profileURI,
                  i._owner
                )
              : await profileAuctionContract2.getStructHash(
                  i._nftTokens ?? BigNumber.from(0),
                  i._profileURI,
                  i._owner
                );

          let blockMinted =
            index % 2 === 0
              ? await profileAuctionContract.claimableBlock(structHash)
              : await profileAuctionContract2.claimableBlock(structHash);

          return {
            user: address,
            _timeCreated: i._timeCreated,
            _timeUpdated: i._timeUpdated,
            _stakeWeightedSeconds: i._stakeWeightedSeconds,
            _nftTokens: i._nftTokens,
            _blockMinted: blockMinted ? Number(blockMinted._hex) : -1,
            _profileURI: i._profileURI,
            _blockWait: i._blockWait,
            bidStatus: bidStatusArr[index],
            place: bidOrderArr[index].place,
            totalBids: bidOrderArr[index].totalBids
          };
        })
      );

      annotatedBids = annotatedBids.filter(i => i.bidStatus !== 2);

      return res.json({
        bids: annotatedBids,
        profileFee
      });
    } else {
      return res.status(400).json({
        message: "address is not valid",
        code: 400
      });
    }
  } catch (err) {
    console.log("error getIndividualBids: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

const getWatching = async uri => {
  let watching = await WatchList.find({
    uri: uri.toLowerCase()
  }).exec();

  return { watching: watching.length };
};

const getViews = async uri => {
  let views = await Views.findOne({
    profileURI: uri.toLowerCase()
  }).exec();

  return { views: views ? views.views : 0 };
};

const recordView = async uri => {
  let foundView = await Views.findOne({
    profileURI: uri.toLowerCase()
  }).exec();

  if (!foundView) {
    await Views.create({
      profileURI: uri.toLowerCase(),
      views: 1
    });
  } else {
    foundView.views += 1;
    await foundView.save();
  }
};

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

const p = isProduction(process.env.CHAIN_ID);

exports.getProfileDetails = async (req, res, next) => {
  try {
    let { uri } = req.params;

    let nftProfileContract = await getContract(
      "nftProfile",
      process.env.CHAIN_ID
    );

    let profileTokenId = await nftProfileContract.getTokenId(uri);
    let tokenId = Number(profileTokenId._hex);
    let profileDetails = await nftProfileContract.profileDetails(tokenId);
    let creatorCoin = await nftProfileContract.creatorCoin(tokenId);

    if (creatorCoin !== `0x0000000000000000000000000000000000000000`) {
      let nftTokenContract = await getContract("nft", process.env.CHAIN_ID);

      let lockedNFT = await nftTokenContract.balanceOf(creatorCoin);

      const creatorCoinContract = new ethers.Contract(
        creatorCoin,
        getABI("nft", process.env.CHAIN_ID),
        provider(p)
      );

      let supplyCreatorCoin = await creatorCoinContract.totalSupply();

      return res.json({
        tokenId,
        creatorCoin,
        profileDetails,
        lockedNFT,
        supplyCreatorCoin
      });
    } else {
      return res.json({
        tokenId,
        creatorCoin,
        profileDetails,
        lockedNFT: 0,
        supplyCreatorCoin: 0
      });
    }
  } catch (err) {
    console.log("profile details error: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

const getUniqueBidsForURI = async uri => {
  let bids = await BidSignatures.find({
    _profileURI: uri.toLowerCase()
  }).exec();

  let sortedBids = sort(bids).desc(r => Number(r._nftTokens));
  let uniqueBids = [];
  let seenBids = {};
  for (let i = 0; i < sortedBids.length; i++) {
    let curr = sortedBids[i];
    let key = `${curr._owner}_${curr._profileURI}`;

    if (!seenBids[key]) {
      uniqueBids.push(curr);
      seenBids[key] = true;
    }
  }

  let nftProfileContract = await getContract(
    "nftProfile",
    process.env.CHAIN_ID
  );
  let profileStatus = 0;

  try {
    await nftProfileContract.getTokenId(uri);

    profileStatus = 2;
  } catch (err) {
    let FoundNewClaimableProfile = await Bids.findOne({
      profileURI: uri.toLowerCase(),
      event: "NewClaimableProfile"
    }).exec();

    if (FoundNewClaimableProfile) profileStatus = 1;
  }

  uniqueBids = uniqueBids.filter(i => i._profileURI === uri);

  return { bids: uniqueBids, profileStatus };
};

exports.getSortedBids = async (req, res, next) => {
  try {
    let { uri } = req.params;

    let { bids, profileStatus } = await getUniqueBidsForURI(uri);

    let returnObject = {
      bids,
      profileStatus // 0 = untaken, 1 = pending claim, 2 = taken
    };

    return res.json(returnObject);
  } catch (err) {
    console.log("error getSortedBids: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};
