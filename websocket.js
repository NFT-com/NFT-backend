const chalk = require("chalk");
const { ethers } = require("ethers");
const cache = require("memory-cache");
const { BigNumber } = require("@ethersproject/bignumber");
const cron = require("node-cron");
const {
  ClaimableBalanceCallBuilder
} = require("stellar-sdk/lib/claimable_balances_call_builder");
const BidSignatures = require(__dirname + "/models/bidSignatures");
const emoji = require("node-emoji");

const TVL = require(__dirname + "/models/tvl");
const Bids = require(__dirname + "/models/bids");
const Users = require(__dirname + "/models/users");
const URI = require(__dirname + "/models/uri");

const { getContract, getAddress } = require("./httpHooks");

const config = require("./config");

const WSS_URL =
  "wss://rinkeby.infura.io/ws/v3/d6b851d9202b4a939deb6f022270176a";
const wsProvider = new ethers.providers.WebSocketProvider(WSS_URL, "rinkeby");

// ************************************************************
wsProvider.on("block", blockNumber => {
  console.log(chalk.yellow("New Block: " + blockNumber));
});
// ************************************************************

const nftToken = new ethers.Contract(
  config.nftToken.rinkeby.address,
  JSON.parse(config.nftToken.rinkeby.ABI),
  wsProvider
);

const nftProfile = new ethers.Contract(
  config.nftProfile.rinkeby.address,
  JSON.parse(config.nftProfile.rinkeby.ABI),
  wsProvider
);

const profileAuction = new ethers.Contract(
  config.profileAuction.rinkeby.address,
  JSON.parse(config.profileAuction.rinkeby.ABI),
  wsProvider
);

// ************************************************************

const getPastNewBids = async () => {
  let eventFilter = profileAuction.filters.NewBid();

  let events = await profileAuction.queryFilter(eventFilter);

  for (let i = 0; i < events.length; i++) {
    let e = events[i];

    let found = await Bids.findOne({
      event: "NewBid",
      txHash: e.transactionHash,
      profileURI: e.args._val.toLowerCase()
    }).exec();

    if (!found) {
      console.log(
        chalk.green(
          `found NewBid for ${e.args._val.toLowerCase()} with ${Number(
            BigNumber.from(e.args._amount._hex).div(
              BigNumber.apply.from(10).pow(18)
            )
          )} Tokens ${e.args._user}`
        )
      );

      await Bids.create({
        user: e.args._user,
        txHash: e.transactionHash,
        profileURI: e.args._val.toLowerCase(),
        nftToken: e.args._val._hex,
        event: "NewBid",
        blockNumber: e.blockNumber
      });
    }
  }
};

profileAuction.on("NewBid", async (user, profileURI, amount, event) => {
  console.log(
    chalk.green(
      `NewBid for ${profileURI} with ${Number(amount) /
        10 ** 18} Tokens (${user})`
    )
  );

  await Bids.create({
    user,
    txHash: event.transactionHash,
    profileURI: profileURI,
    nftToken: amount,
    event: "NewBid",
    blockNumber: event.blockNumber
  });
});

const getPastMintedProfiles = async () => {
  let eventFilter = profileAuction.filters.MintedProfile();

  let events = await profileAuction.queryFilter(eventFilter);

  for (let i = 0; i < events.length; i++) {
    let e = events[i];

    let found = await Users.findOne({
      txHash: e.transactionHash,
      profileURI: e.args._val.toLowerCase()
    }).exec();

    if (!found) {
      console.log(chalk.yellow(`missing minted profile tx!: ${e.args._val}`));

      let newUser = await Users.create({
        profileURI: e.args._val.toLowerCase(),
        user: e.args._user,
        nftTokenStaked: e.args._amount._hex,
        blockMinted: Number(e.args._blockNum),
        txHash: e.transactionHash
      });

      let foundURI = await URI.findOne({
        profileName: e.args._val.toLowerCase()
      }).exec();

      if (!foundURI) {
        let tokenId = await nftProfile.getTokenId(e.args._val.toLowerCase());

        console.log("tokenId: ", tokenId);

        let newURI = await URI.create({
          tokenId: Number(tokenId),
          profileName: e.args._val.toLowerCase(),
          metadata: {
            title: e.args._val.toLowerCase(),
            name: e.args._val.toLowerCase(),
            description: `profile description for NFT.com/${e.args._val.toLowerCase()}`,
            image:
              "https://nft-com.s3.us-east-2.amazonaws.com/default_user.svg",
            external_url: `NFT.com/${e.args._val.toLowerCase()}`
          }
        });

        console.log(
          chalk.green(`added ${e.args._val} URI to db. uri = ${newURI._id}`)
        );
      }

      console.log(
        chalk.green(`added user to DB: ${e.args._val}. id = ${newUser._id}`)
      );
    }
  }
};

profileAuction.on(
  "RedeemProfile",
  (user, profileURI, block, amount, tokenId, event) => {
    console.log(
      "profileAuction.RedeemProfile: ",
      user,
      profileURI,
      block,
      amount,
      tokenId
    );
  }
);

profileAuction.on(
  "MintedProfile",
  async (user, profileURI, amount, block, event) => {
    console.log(
      chalk.green(
        `MintedProfile for ${profileURI} with ${Number(amount) /
          10 ** 18} Tokens ${user}`
      )
    );

    let found = await Users.findOne({
      profileURI: profileURI.toLowerCase(),
      txHash: event.transactionHash
    }).exec();

    let foundURI = await URI.findOne({
      profileName: profileURI.toLowerCase()
    }).exec();

    if (!found) {
      await Users.create({
        profileURI,
        user,
        nftTokenStaked: amount,
        blockMinted: block,
        txHash: event.transactionHash
      });

      if (!foundURI) {
        let tokenId = await nftProfile.getTokenId(profileURI.toLowerCase());

        console.log("tokenId: ", tokenId);

        let newURI = await URI.create({
          tokenId: Number(tokenId),
          profileName: profileURI.toLowerCase(),
          metadata: {
            title: profileURI.toLowerCase(),
            name: profileURI.toLowerCase(),
            description: `profile description for NFT.com/${profileURI.toLowerCase()}`,
            image:
              "https://nft-com.s3.us-east-2.amazonaws.com/default_user.svg",
            external_url: `NFT.com/${profileURI.toLowerCase()}`
          }
        });

        console.log(
          chalk.green(`added ${profileURI} URI to db. uri = ${newURI._id}`)
        );
      }

      console.log(
        "profileAuction.MintedProfile: ",
        user,
        profileURI,
        amount,
        block
      );
    }
  }
);

profileAuction.on(
  "NewClaimableProfile",
  async (user, profileURI, amount, block, event) => {
    console.log(
      chalk.green(
        `NewClaimableProfile for ${profileURI} with ${Number(
          amount
        )} Tokens ${user}`
      )
    );

    await Bids.create({
      user,
      txHash: event.transactionHash,
      blockNumber: block,
      profileURI: profileURI.toLowerCase(),
      nftToken: amount,
      event: "NewClaimableProfile"
    });
  }
);

const getPastNewClaimableProfiles = async () => {
  let eventFilter = profileAuction.filters.NewClaimableProfile();

  let events = await profileAuction.queryFilter(eventFilter);

  for (let i = 0; i < events.length; i++) {
    let e = events[i];

    let found = await Bids.findOne({
      event: "NewClaimableProfile",
      txHash: e.transactionHash,
      profileURI: e.args._val.toLowerCase()
    }).exec();

    if (!found) {
      console.log("not found e: ", e);

      console.log(
        chalk.green(
          `found NewClaimableProfile for ${e.args._val.toLowerCase()} with ${Number(
            BigNumber.from(e.args._amount._hex).div(BigNumber.from(10).pow(18))
          )} Tokens ${e.args._user}`
        )
      );

      await Bids.create({
        user: e.args._user,
        txHash: e.transactionHash,
        profileURI: e.args._val.toLowerCase(),
        nftToken: e.args._amount._hex,
        event: "NewClaimableProfile",
        blockNumber: Number(e.args._blockNum._hex)
      });
    }
  }
};

// ************************************************************
//
async function cleanDB() {
  let users = await Users.find({}).exec();

  let seenUser = {};
  for (let i = 0; i < users.length; i++) {
    let currUser = users[i];

    let key = `${currUser.profileURI}_${currUser.txHash}`;

    // if haven't seen, keep
    if (!seenUser[key]) {
      seenUser[key] = true;
    } else {
      console.log(`======> SEEN USER!... ${key}`);
      currUser.delete();
    }
  }

  let bids = await Bids.find({}).exec();

  let seenBid = {};
  for (let i = 0; i < bids.length; i++) {
    let currBid = bids[i];

    let key = `${currBid.profileURI}_${currBid.txHash}`;

    // if haven't seen, keep
    if (!seenBid[key]) {
      seenBid[key] = true;
    } else {
      console.log(`======> SEEN BID!... ${key}`);
      currBid.delete();
    }
  }

  let uris = await URI.find({}).exec();

  let seenURI = {};
  for (let i = 0; i < uris.length; i++) {
    let currURI = uris[i];

    let key = `${currURI.profileName}_${currURI.tokenId}`;

    // if haven't seen, keep
    if (!seenURI[key]) {
      seenURI[key] = true;
    } else {
      console.log(`======> SEEN URI!... ${key}`);
      currURI.delete();
    }
  }
}

const checkPastData = async () => {
  try {
    getPastMintedProfiles();
    getPastNewBids();
    getPastNewClaimableProfiles();

    cleanDB();
  } catch (err) {
    console.log(chalk.red("error while doing cron: ", err));
  }
};

const liveNftPrice = async () => {
  return 0.1;
};

const syncAlgoliaIndex = () => {
  BidSignatures.SyncToAlgolia()
    .then(success => {
      console.log(
        emoji.get("person_with_blond_hair"),
        chalk.green("synced Bid Sigantures with algolia, ", success)
      );
    })
    .catch(error => {
      console.log(chalk.red("failed to sync successfully...", error));
    });
};

// clean leaderboard will scan through all of the current bids
// it will ensure that at any given moment, a user has sufficient NFT tokens in his/her account for a bid
// if any bid > user's current balance, remove and notify user (if email exists)
const cleanLeaderBoard = async () => {
  console.log("cleaning bids...");
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

// TODO: increase limits and make sure we update in time
// syncAlgoliaIndex();

async function fiveMinuteSchedule() {
  cron.schedule(
    "0 */5 * * * *",
    () => {
      console.log("...cleanup cron...");
      storeCurrentTVL();
      cleanLeaderBoard();
    },
    {
      scheduled: true,
      timezone: "America/Chicago"
    }
  );
}

async function minuteSchedule() {
  cron.schedule(
    "0 */1 * * * *",
    () => {
      console.log("...cleanup cron...");
      checkPastData();
    },
    {
      scheduled: true,
      timezone: "America/Chicago"
    }
  );
}

fiveMinuteSchedule();
minuteSchedule();

module.exports = {
  wsProvider
};
