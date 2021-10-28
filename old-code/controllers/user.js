const User = require(__dirname + "/../models/users");
const Account = require(__dirname + "/../models/accounts");
const NftMetaData = require(__dirname + "/../models/nftMetaData");
const URI = require(__dirname + "/../models/uri");
const Gallery = require(__dirname + "/../models/gallery");
const ContractABI = require(__dirname + "/../models/contractABIs");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SG_API_KEY);
const validator = require("email-validator");
const { BigNumber } = require("bignumber.js");
const cache = require("memory-cache");
const { ethers } = require("ethers");
const { provider, getRandomAPI } = require("../provider");
const axios = require("axios");
const crypto = require("crypto");
const urlencode = require("urlencode");
const config = require("../config");
const chalk = require("chalk");
const sls = require("single-line-string");

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

const prefixEtherscan = p => {
  if (p) {
    return "api";
  } else {
    return "api-rinkeby";
  }
};

const parseIpfs = uri => {
  if (uri?.includes("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri?.replace("ipfs://", "")}`;
  } else if (uri?.includes("https://")) {
    if (uri?.includes("nft.com") && !p) {
      return uri?.replace("api.nft.com", "z6139110241.herokuapp.com");
    } else {
      return uri;
    }
  } else if (uri?.length === 59) {
    return `https://ipfs.io/ipfs/${uri}`;
  }
};

// returns email
exports.getUserAccount = async (req, res, next) => {
  try {
    let { userAddress } = req.query;

    if (!userAddress || userAddress === "undefined" || userAddress === "null") {
      return res.status(400).json({
        message: "userAddress query not passed in"
      });
    }

    let foundUser = await Account.findOne({
      userAddress: userAddress.toLowerCase()
    }).exec();

    if (!foundUser) {
      return res.json({
        message: "success",
        email: "null",
        verified: "false"
      });
    } else {
      return res.json({
        message: "success",
        email: foundUser.emailAddress.toLowerCase(),
        verified: foundUser.verifiedEmail
      });
    }
  } catch (err) {
    console.log("error getUser: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

// this function will be used to verify a user email vi a 6 digit numerical code
exports.verifyUser = async (req, res, next) => {
  try {
    let { code, emailAddress } = req.body;

    emailAddress = emailAddress.toLowerCase();

    let foundUser = await Account.findOne({
      emailAddress
    }).exec();

    if (!foundUser) {
      return res.status(400).json({
        message: "user not found"
      });
    } else if (!code || code === "undefined") {
      return res.status(400).json({
        message: "code not found"
      });
    } else {
      if (Number(code) !== Number(foundUser.authenticateCode)) {
        return res.status(400).json({
          message: "incorrect code"
        });
      } else {
        foundUser.verifiedEmail = true;
        await foundUser.save();

        if (foundUser.referredBy) {
          let referralUser = await Account.findOne({
            userAddress: foundUser.referredBy.toLowerCase()
          }).exec();

          let totalReferrals = await Account.count({
            referredBy: foundUser.referredBy.toLowerCase(),
            verifiedEmail: true
          }).exec();

          if (referralUser.emailAddress) {
            const msg = {
              to: referralUser.emailAddress,
              from: "noreply@nft.com",
              subject: `New NFT.com Referral! ${new Date().toUTCString()}`,
              text: `A new NFT.com user has signed up using your referral code. \n\n[${new Date().toUTCString()}] \n\nYou have successfully referred ${totalReferrals} users.`
            };

            // send email
            await sgMail.send(msg);
          }
        }

        return res.json({
          message: "success"
        });
      }
    }
  } catch (err) {
    console.log("error addUser: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

// this function will be used to add a new user with email in our system
exports.addUser = async (req, res, next) => {
  try {
    let { userAddress, referredBy, emailAddress } = req.body;

    // format
    userAddress = userAddress.toLowerCase();
    emailAddress = emailAddress.toLowerCase();
    referredBy = referredBy.toLowerCase();

    // 6 digit code
    let authCode = Math.floor(100000 + Math.random() * 900000);

    let foundUser = await Account.findOne({
      emailAddress
    }).exec();

    if (foundUser) {
      if (foundUser.verifiedEmail) {
        return res.status(400).json({
          message: "user email already exists"
        });
      } else { // resubmit email
        foundUser.authenticateCode = authCode;

        if (foundUser.userAddress !== userAddress) {
          foundUser.userAddress = userAddress;
        }

        await foundUser.save();

        const msg = {
          to: emailAddress,
          from: "noreply@nft.com",
          subject: `Your NFT.com login code is ${authCode}`,
          text: `Your NFT.com login code is ${authCode}. \n\n[${new Date().toUTCString()}] \n\nThis is a one-time code that expires in 10 minutes. \n\nDo not share your code with anyone. The NFT.com team will never ask for it.`
        };
  
        // send email
        await sgMail.send(msg);
  
        return res.json({
          message: "success"
        });
      }
    } else {
      // valid email format - add referrrer
      if (validator.validate(emailAddress)) {
        let referral = await Account.findOne({
          userAddress: referredBy
        }).exec();

        if (!referral || referral.verifiedEmail === false) {
          await Account.create({
            userAddress,
            emailAddress,
            authenticateCode: authCode
          });
        } else {
          await Account.create({
            userAddress,
            emailAddress,
            referredBy,
            authenticateCode: authCode
          });
        }
      } else {
        // no referral, just a new user
        await Account.create({
          userAddress,
          emailAddress,
          authenticateCode: authCode
        });
      }

      const msg = {
        to: emailAddress,
        from: "noreply@nft.com",
        subject: `Your NFT.com login code is ${authCode}`,
        text: `Your NFT.com login code is ${authCode}. \n\n[${new Date().toUTCString()}] \n\nThis is a one-time code that expires in 10 minutes. \n\nDo not share your code with anyone. The NFT.com team will never ask for it.`
      };

      // send email
      await sgMail.send(msg);

      return res.json({
        message: "success"
      });
    }
  } catch (err) {
    console.log("error addUser: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    let { username, description } = req.query;

    let foundURI = await URI.findOne({
      profileName: username
    }).exec();

    console.log(chalk.magenta("update profile! =============>", description));

    if (req.user && foundURI) {
      if (req.files.image) {
        if (req.files.image[0].location) {
          let url = req.files.image[0].location;
          req.user.profileURL = url;
          req.user.profileVersion = (req.user.profileVersion || 0) + 1;

          foundURI.metadata.image = url;
        }
      }

      if (req.files.header) {
        if (req.files.header[0].location) {
          let url = req.files.header[0].location;
          req.user.headerURL = url;
          req.user.headerVersion = (req.user.headerVersion || 0) + 1;
        }
      }

      if (description) {
        foundURI.metadata.description = urlencode.decode(description, "gbk");
      }

      await req.user.save();
      await foundURI.save();

      console.log(chalk.magenta("success"));
      return res.send({ message: "successfully updated" });
    } else {
      return res.status(400).json({
        message: "user not found"
      });
    }
  } catch (err) {
    console.log("error updateProfile: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.getEtherScanNFTs = async (req, res, next) => {
  try {
    const { targetAddress, clearCache } = req.query;

    if (
      targetAddress === "undefined" ||
      targetAddress === undefined ||
      targetAddress === null ||
      !targetAddress ||
      targetAddress === ""
    ) {
      return res.status(401).json({
        message: "target must be defined"
      });
    }

    let key = `etherscanNft_${targetAddress}`;
    let val = cache.get(key);

    if (val && !clearCache) {
      return res.json(val);
    } else {
      const url = `https://${prefixEtherscan(
        p
      )}.etherscan.io/api?module=account&action=tokennfttx&address=${targetAddress}&startblock=0&endblock=999999999&sort=asc&apikey=${getRandomAPI()}`;
      let etherscanResp = await axios.get(url);
      let transactions = etherscanResp.data.result;
      let assets = [];

      for (let i = 0; i < transactions.length; i++) {
        console.log(
          `looping through NFTs(${i}/${transactions.length}) ${transactions[i].tokenName}`
        );

        if (transactions[i].tokenName === undefined) {
          console.log("targetAddress: ", targetAddress);
          console.log("transactions: ", transactions);
        }

        const contractAddress = transactions[i].contractAddress;

        let internal = true;
        let abi = await ContractABI.findOne({
          contractAddress: contractAddress.toLowerCase()
        }).exec();

        if (abi === null || abi === undefined) {
          try {
            console.log(chalk.red(`======> abi not found...`));
            let getProxyURL = `https://${prefixEtherscan(
              p
            )}.etherscan.io/api?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${getRandomAPI()}`;
            let proxyResult = await axios.get(getProxyURL);
            let implementation = proxyResult.data.result[0].Implementation;

            let newContract =
              implementation === "" ? contractAddress : implementation;

            let abiURL = `https://${prefixEtherscan(
              p
            )}.etherscan.io/api?module=contract&action=getabi&address=${newContract}&apikey=${getRandomAPI()}`;
            let abiResult = await axios.get(abiURL);

            if (abiResult.data.result === "Contract source code not verified") {
              console.log(
                `Contract source code not verified for ${contractAddress}`
              );
            } else {
              abi = abiResult.data.result;

              internal = false;

              let newContract = await ContractABI.create({
                contractAddress: contractAddress.toLowerCase(),
                implementation,
                ABI: abi
              });

              console.log(`Set abi: ${contractAddress} - ${newContract._id}`);
            }
          } catch (err) {
            console.error(
              "Failed to load ABI for",
              transactions[i].tokenName,
              contractAddress
            );
            continue;
          }
        }

        try {
          abi = JSON.parse(sls`${internal ? abi.ABI : abi}`);
        } catch (e) {
          console.log("parsing fail: ", e);
          console.log(
            "Failed to parse abi for",
            transactions[i].tokenName,
            contractAddress
          );
          continue;
        }

        try {
          const contract = new ethers.Contract(
            contractAddress,
            abi,
            provider(p)
          );

          let owner = await contract.ownerOf(transactions[i].tokenID);
          if (owner.toLowerCase() === targetAddress.toLowerCase()) {
            let tokenURI = await contract.tokenURI(transactions[i].tokenID);
            let formattedURI = parseIpfs(tokenURI);
            try {
              let foundMetaData = await NftMetaData.findOne({
                tokenURI: tokenURI?.toLowerCase()
              }).exec();

              if (foundMetaData) {
                assets.push({
                  name: transactions[i].tokenName,
                  symbol: transactions[i].tokenSymbol,
                  description: foundMetaData?.description,
                  tokenId: transactions[i].tokenID,
                  contractAddress,
                  abi,
                  image: foundMetaData?.imageURL
                });
              } else {
                const uriData = await axios.get(formattedURI);

                // @dev: can query opensea for a select number of pre-listed items. need to parse and format correctly if used
                // const openseaURL = `https://${prefixOpensea(
                //   p
                // )}.opensea.io/api/v1/asset/${contractAddress}/${
                //   transactions[i].tokenID
                // }`;
                // const images = await axios.get(openseaURL);

                assets.push({
                  name: transactions[i].tokenName,
                  symbol: transactions[i].tokenSymbol,
                  description: uriData?.data?.description,
                  tokenId: transactions[i].tokenID,
                  contractAddress,
                  abi,
                  image:
                    uriData?.data?.properties?.image?.description ??
                    uriData?.data?.image
                });

                let newNFT = await NftMetaData.create({
                  tokenURI: tokenURI?.toLowerCase(),
                  contractAddress,
                  imageURL:
                    uriData?.data?.properties?.image?.description ??
                    uriData?.data?.image,
                  tokenId: transactions[i].tokenID,
                  description: uriData?.data?.description,
                  name: transactions[i].tokenName,
                  symbol: transactions[i].tokenSymbol,
                  type: 721 // 721, 1155, etc
                });

                console.log("newNFT ", newNFT._id);
              }
            } catch (err2) {
              console.log("rest parse error: ", err2);
              console.log(
                "Failed to parse on rest",
                transactions[i].tokenName,
                contractAddress
              );
            }
          } else {
            // console.log(
            //   `token owner invalid: ${owner.toLowerCase()} != ${targetAddress.toLowerCase()} on contract ${contractAddress} (#${
            //     transactions[i].tokenID
            //   })`
            // );
          }
        } catch (err) {
          console.log(`error while validating token ownership: ${err}`);
        }
      }

      let objectStore = {
        message: "success",
        assets
      };

      cache.put(key, objectStore, 1000 * 60); // save for 60 seconds

      return res.json(objectStore);
    }
  } catch (err) {
    console.log("error getEtherScanNFTs: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.getUser = async (req, res, next) => {
  try {
    let { username } = req.params;

    if (!username || username === "undefined" || username === "null") {
      return res.status(400).json({
        message: "username query not passed in"
      });
    }

    const passedInSignature = req.headers["signature"];

    var hmac = crypto.createHmac("sha256", process.env.CLIENT_SECRET);
    var calculatedSignature = hmac
      .update(`${username.toLowerCase()}`)
      .digest("hex");

    if (calculatedSignature === passedInSignature) {
      let foundUser = await User.findOne({
        profileURI: username.toLowerCase()
      }).exec();

      let foundURI = await URI.findOne({
        profileName: username.toLowerCase()
      }).exec();

      if (!foundUser || !foundURI) {
        return res.status(401).json({
          message: "profile not found"
        });
      } else {
        return res.json({
          message: "success",
          user: foundUser,
          uriData: foundURI
        });
      }
    } else {
      return res.status(400).json({
        message: "invalid auth"
      });
    }
  } catch (err) {
    console.log("error getUser: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.getGallery = async (req, res, next) => {
  try {
    let { account } = req.params;

    const passedInSignature = req.headers["signature"];

    var hmac = crypto.createHmac("sha256", process.env.CLIENT_SECRET);
    var calculatedSignature = hmac
      .update(`${account.toLowerCase()}`)
      .digest("hex");

    if (calculatedSignature === passedInSignature) {
      let items = await Gallery.find({
        account: account.toLowerCase()
      }).exec();

      return res.json({
        message: "success",
        data: items
      });
    } else {
      return res.status(400).json({
        message: "invalid auth"
      });
    }
  } catch (err) {
    console.log("error getGallery: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.addNFT = async (req, res, next) => {
  try {
    let { account, contractAddress, uri, uriData, owner, tokenId } = req.body;

    const passedInSignature = req.headers["signature"];

    var hmac = crypto.createHmac("sha256", process.env.CLIENT_SECRET);
    var calculatedSignature = hmac
      .update(`${account.toLowerCase()}_${contractAddress.toLowerCase()}`)
      .digest("hex");

    const debug = true;
    const sameAddress =
      debug || account?.toLowerCase() === owner?.toLowerCase();

    if (calculatedSignature === passedInSignature && sameAddress) {
      let updatedURI =
        process.env.LOCAL === "true"
          ? uri?.replace("https://api.nft.com", config.productionURL)
          : uri;

      let findObject = {
        account,
        owner,
        contractAddress,
        uri: updatedURI,
        tokenId
      };

      let foundGallery = await Gallery.findOne(findObject).exec();

      if (!foundGallery) {
        let newGallery = await Gallery.create({
          account,
          owner,
          contractAddress,
          uri: updatedURI,
          tokenId,
          uriData,
          name: uriData?.title || uriData?.name,
          description:
            uriData?.properties?.name?.description || uriData?.description,
          image:
            uriData?.properties?.image?.description || parseIpfs(uriData?.image)
        });

        return res.json({
          message: "success",
          details: newGallery._id
        });
      } else {
        return res.status(400).json({
          message: "gallery object already exists for user"
        });
      }
    } else {
      return res.status(400).json({
        message: "invalid auth"
      });
    }
  } catch (err) {
    console.log("error add721: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};

exports.test = async (req, res, next) => {
  try {
    return res.json({
      message: "succcess"
    });
  } catch (err) {
    console.log("error: ", err);
    return res.status(401).json({
      message: "error",
      details: err
    });
  }
};
