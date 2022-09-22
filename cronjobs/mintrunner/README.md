# Cronjob - MintRunner - Details

The MintRunner is a script that is scheduled to run daily to query the NFT.com smart contracts to pull information regaring NFT.com Genesis Key (GK) and Profile mints. Specifically it will query our GK contracts (for sale, treasury, insider) to determine the distribution of GK claims, and then it will query each of the 10k GKs to determine how many profile mints are remaining on each GK. This information is persisted to a small analytics DB (seperate from our GQL db) which Metabase uses for visualizing this information. 

The respective metabase dashboard for this data can be found here: https://nft-com.metabaseapp.com/dashboard/39-nft-com-minting-data

The script is built to run on ECS Fargate and also locally. Use the instructions below to run the script locally. 

### 1. Requirements

1. Python
2. Docker
3. Postgres database 

### 2. Run Instructions

1. Start a local database, create 'local_mints' table with the provided sql (mints.sql)
2. Update .env file with local database details and an ETH Node endpoint (Free Infura subscription works fine)
3. Install depedencies `pip3 install python-dotenv psycopg2 web3`
4. Then execute `python3 mint.py`

### 3 Additional Documentation

See extended documentation on how serverless cronjobs are setup via Notion: 
https://www.notion.so/immutableholdings/Running-Serverless-Cronjobs-a132b5d688654fb095bc4a5902546ba8 

