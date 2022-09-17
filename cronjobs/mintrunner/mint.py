import psycopg2
import json
import os
from web3 import Web3
from datetime import date
from dotenv import load_dotenv

load_dotenv()

today = date.today()
node_url = os.getenv('ETH_NODE_URL')
web3 = Web3(Web3.HTTPProvider(node_url))

if os.getenv('ENV') == "local":
    genesisKeyABI = "GenesisKey.json"
    profileAuctionABI = "ProfileAuction.json"
else:
    # for dockerfile
    genesisKeyABI = "/app/GenesisKey.json"
    profileAuctionABI = "/app/ProfileAuction.json"


## first get number of gk's in circulation 
with open(genesisKeyABI) as file:
    gkAbi = json.load(file)

gkAddress = '0x8fb5a7894ab461a59acdfab8918335768e411414'
gkCheckSumAddress = Web3.toChecksumAddress(gkAddress.lower())
gkContract = web3.eth.contract(address = gkCheckSumAddress, abi = gkAbi)
gkOwned = gkContract.functions.balanceOf(gkCheckSumAddress).call()

treasuryAddress = '0x1d438f0ca004e3ec155df9e7e0457215483de8d5'
treasuryCheckSumAddress = Web3.toChecksumAddress(treasuryAddress.lower())
treasuryOwned = gkContract.functions.balanceOf(treasuryCheckSumAddress).call()

insiderAddress = '0xfc99e6b4447a17ea0c6162854fcb572ddc8fbb37'
insiderCheckSumAddress = Web3.toChecksumAddress(insiderAddress.lower())
insiderOwned = gkContract.functions.balanceOf(insiderCheckSumAddress).call()

# gkInCirculation is the real number of GKs in circulation 
gkInCirculation = 10000 - gkOwned - treasuryOwned - insiderOwned
# totalGKs is the tokenRange we need to query to determine proper mints
totalGks = 10000 - gkOwned - treasuryOwned

# call profileAuction contract for profiles remaining per gk
with open(profileAuctionABI) as file:
    profileAbi = json.load(file)

mintedProfiles = 0
profileAddress = '0x30f649D418AF7358f9c8CB036219fC7f1B646309'
profileCheckSumAddress = Web3.toChecksumAddress(profileAddress.lower())
profileContract = web3.eth.contract(address = profileCheckSumAddress, abi = profileAbi)

# determine mints available 
#for x in range(1,gkInCirculation+1):
for x in range(1,totalGks+1):
    try:
        y = profileContract.functions.genesisKeyClaimNumber(x).call()
    except:
        print("exception, tokenid: " + str(x) + ", output: " + str(y))
    #print("TokenID: " + str(x) + " - result: " + str(y)) # for debugging 
    mintedProfiles += y

unmintedProfiles = (gkInCirculation * int(os.getenv('PROFILE_PER_GK'))) - mintedProfiles
#print("Total GKs in Circulation: " + str(gkInCirculation))
#print("Total Mints Remaining on GKs in Circulation: " + str(unmintedProfiles))
#print("Total Mints Spent on GKs in Circulation: " + str(mintedProfiles))

# update database
tableName = os.getenv('MINT_TABLE_NAME') # using 1 db, so diff table name per env
dbConn = psycopg2.connect(database=os.getenv('DB_NAME'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASS'), host=os.getenv('DB_HOST'), port=os.getenv('DB_PORT'))
dbCur = dbConn.cursor()
dbCur.execute("INSERT into " + tableName + " (date,freeMints,usedMints,gkInCirculation,gkUnclaimed,treasuryUnclaimed,insiderUnclaimed) VALUES (%s,%s,%s,%s,%s,%s,%s)",(today,unmintedProfiles,mintedProfiles,gkInCirculation,gkOwned,treasuryOwned,insiderOwned))
dbConn.commit()
dbConn.close()
