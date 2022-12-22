# NFT.com GQL Server

## [Click here to see SchemaAPI](./schema.md)

## **How to Set Up the Hedera Consensus Service With Production**

### **Requirements**

 - A **funded** mainnet account:
	 - Account id
	 - Private key
 -  Mainnet topic id

### **High Level Instructions**

1. With your funded mainnet account, create a mainnet topic id.
2. Set into your secrets platform's **production** config:

       HCS_ACCOUNT_ID = mainnet account id
       HCS_PRIVATE_KEY = mainnet account private key
       HCS_TOPIC_ID = newly (or previously) created mainnet topic id

	   HCS_ENABLED = whether HCS is enabled

### **Supplemental Guides**

- **How to create a mainnet account**
	- If you do not yet have a mainnet account, you may create one by following [this guide](https://launchbadge.com/blog/creating-a-software-hedera-account-through-atomic-wallet-to-load-in-myhbarwallet)
- **How to create a mainnet topic id**
	- \**This is an abridged and updated guide for Hedera's [Get started with Hedera's JavaScript SDK](https://hedera.com/blog/get-started-with-javascript) and [Get started with HCS and JavaScript](https://hedera.com/blog/get-started-with-hcs-and-javascript) guides*
   1.  Installation requirements
       - Node version > v10
       - NPM version > v6
   2. Create a node project and install [@hashgraph/sdk](https://github.com/hashgraph/hedera-sdk-js)
		    
	      mkdir HCS-create-topic 
		  cd HCS-create-topic
		  npm init -y 
		  npm i @hashgraph/sdk
			
   3. Set in your environment variables the following:
	
	      HCS_ACCOUNT_ID = mainnet account id
	      HCS_PRIVATE_KEY = mainnet account private key
		   
   4. Create an `index.js` file and copy paste the following:
			
	      // import necessary modules from the Hedera JS SDK
		  const { Client, TopicCreateTransaction } = require("@hashgraph/sdk");
			
		  async function main() {
              // grab our mainnet account environment variables
		      const operatorAccount = process.env.HCS_ACCOUNT_ID;
		      const operatorPrivateKey = process.env.HCS_PRIVATE_KEY;

		      // configure a client with our account id & private key
		      const client = Client.forMainnet();
		      client.setOperator(operatorAccount, operatorPrivateKey);

		      // create topic
		      const topicId = await createTopic(client);
		      console.log(`Your new topic id: ${topicId}`);
		  }

		  async function createTopic(client) {
		      // build & execute our new 'topic create' transaction
		      const createTopicTransactionId = await new TopicCreateTransaction().execute(
		        client
		    );

		      // get the receipt of our transaction to see if it was successful
		      const createTopicReceipt = await createTopicTransactionId.getReceipt(
		        client
		    );

		      // if it was successful, it will contain a new topic id 👍
		      const topicId = createTopicReceipt.topicId;
		      return topicId;
		  }

		  main();

   5. Run `node index.js` and after a few seconds, you should see `Your new topic id: 0.0.x` output in your console if everything runs smoothly.

### **Usage**
1. Import HederaConsensusService
    -  `import HederaConsensusService from 'path/to/hedera.service.ts'`
2. Submit a message
	-  `HederaConsensusService.submitMessage(MESSAGE)` where `MESSAGE` is what you would like to submit to the topic.
		- There should already be a subscription set for `HCS_TOPIC_ID`, so once the submitted message has reached consensus in the Hedera network, the message will be logged to the console.

### **Costs**
|  API Call |  Estimated Fees |
|--|--|
| Creating a topic | $0.01 — 0.083333ℏ |
| Sending a message to a topic | $0.0001 — 0.000833ℏ |

### **Notes**
- If your flow involves topic creation and subsequent subscription to the newly created topic id, it's best to add 5 seconds of buffer time between topic creation and topic subscription to allow for the newly created topic id to fully commit to consensus.

### **Sources**
- [Hedera Consensus Service](https://hedera.com/consensus-service)
- [Hedera Documentation](https://docs.hedera.com/guides/getting-started/try-examples/submit-your-first-message#1.-create-your-first-topic)
	- [Create a topic](https://docs.hedera.com/guides/getting-started/try-examples/submit-your-first-message#1.-create-your-first-topic)
	- [Subscribe to a topic](https://docs.hedera.com/guides/getting-started/try-examples/submit-your-first-message#1.-create-your-first-topic)
	- [Submit a message](https://docs.hedera.com/guides/getting-started/try-examples/submit-your-first-message#1.-create-your-first-topic)
