const Approvals = require(__dirname + "/models/approvals");
const BidSignatures = require(__dirname + "/models/bidSignatures");
const { BigNumber } = require("@ethersproject/bignumber");
const axios = require("axios");
const { getContract, getAddress } = require("./httpHooks");

async function test() {
    try {
        let approval = await Approvals.find().exec();
        console.log('approval: ', approval);

        let nftContract = await getContract('nft');

        nftContract.permit(
            approval.owner,
            approval.spender,
            approval.value,
            approval.deadline,
            approval.v,
            approval.r,
            approval.s
        )
    } catch (err) {
        console.log('test: ', err);
    }
}

test();