use ethabi::Token;
use substreams::scalar::BigInt;

#[derive(Debug, Clone, PartialEq)]
pub struct NonceInvalidationParameters {
    pub nonce: BigInt,
    pub minimum_timestamp: u64,
    pub maximum_timestamp: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TakerAskV2Event {
    pub nonce_invalidation_parameters: NonceInvalidationParameters,
    pub ask_user: Vec<u8>,
    pub bid_user: Vec<u8>,
    pub strategy_id: BigInt,
    pub currency: Vec<u8>,
    pub collection: Vec<u8>,
    pub item_ids: Vec<BigInt>,
    pub amounts: Vec<BigInt>,
    pub fee_recipients: [Vec<u8>; 2],
    pub fee_amounts: [BigInt; 3],
}

#[derive(Debug, Clone, PartialEq)]
pub struct TakerBidV2Event {
    pub nonce_invalidation_parameters: NonceInvalidationParameters,
    pub bid_user: Vec<u8>,
    pub bid_recipient: Vec<u8>,
    pub strategy_id: BigInt,
    pub currency: Vec<u8>,
    pub collection: Vec<u8>,
    pub item_ids: Vec<BigInt>,
    pub amounts: Vec<BigInt>,
    pub fee_recipients: [Vec<u8>; 2],
    pub fee_amounts: [BigInt; 3],
}

impl TakerAskV2Event {
    // Define the TOPIC_ID for TakerAskV2Event using the provided hash value.
    const TOPIC_ID: [u8; 32] = [
        0x9a, 0xaa, 0x45, 0xd6, 0xdb, 0x2e, 0xf7, 0x4e, 0xad, 0x07, 0x51, 0xea, 0x91, 0x13, 0x26,
        0x3d, 0x1d, 0xec, 0x1b, 0x50, 0xce, 0xa0, 0x5f, 0x0c, 0xa2, 0x00, 0x2c, 0xb8, 0x06, 0x35,
        0x64, 0xa4,
    ];

    pub fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        if log.topics.len() != 4usize {
            return false;
        }
        log.topics.get(0).expect("bounds already checked").as_ref() == Self::TOPIC_ID
    }

    pub fn decode(log: &substreams_ethereum::pb::eth::v2::Log) -> Result<Self, String> {
        let data = &log.data;
        let decoded_data: Vec<Token> = ethabi::decode(
            &[
                ethabi::ParamType::Tuple(vec![
                    ethabi::ParamType::Uint(256),
                    ethabi::ParamType::Uint(256),
                    ethabi::ParamType::Uint(256),
                ]),
                ethabi::ParamType::Address,   // askUser
                ethabi::ParamType::Address,   // bidUser
                ethabi::ParamType::Uint(256), // strategyId
                ethabi::ParamType::Address,   // currency
                ethabi::ParamType::Address,   // collection
                ethabi::ParamType::Array(Box::new(ethabi::ParamType::Uint(256))), // itemIds
                ethabi::ParamType::Array(Box::new(ethabi::ParamType::Uint(256))), // amounts
                ethabi::ParamType::FixedArray(Box::new(ethabi::ParamType::Address), 2), // feeRecipients
                ethabi::ParamType::FixedArray(Box::new(ethabi::ParamType::Uint(256)), 3), // feeAmounts
            ],
            &data,
        )
        .map_err(|e| format!("unable to decode data: {:?}", e))?;

        // Extract nonce invalidation parameters
        let nonce_invalidation_parameters = match &decoded_data[0] {
            Token::Tuple(ref tuple) => NonceInvalidationParameters {
                nonce: BigInt::from_signed_bytes_be(
                    &tuple[0].clone().to_uint().unwrap().as_bytes(),
                ),
                minimum_timestamp: tuple[1].clone().to_uint().unwrap().as_u64(),
                maximum_timestamp: tuple[2].clone().to_uint().unwrap().as_u64(),
            },
            _ => return Err("invalid nonce invalidation parameters".to_string()),
        };

        // Extract item_ids
        let item_ids = match &decoded_data[6] {
            Token::Array(ref array) => array
                .iter()
                .map(|token| BigInt::from_signed_bytes_be(&token.to_uint().unwrap().as_bytes()))
                .collect(),
            _ => return Err("invalid item ids".to_string()),
        };

        // Extract amounts
        let amounts = match &decoded_data[7] {
            Token::Array(ref array) => array
                .iter()
                .map(|token| BigInt::from_signed_bytes_be(&token.to_uint().unwrap().as_bytes()))
                .collect(),
            _ => return Err("invalid amounts".to_string()),
        };

        // Extract fee recipients
        let fee_recipients = match &decoded_data[8] {
            Token::FixedArray(ref array) => [
                array[0].clone().to_address().unwrap().as_bytes().to_vec(),
                array[1].clone().to_address().unwrap().as_bytes().to_vec(),
            ],
            _ => return Err("invalid fee recipients".to_string()),
        };

        // Extract fee amounts
        let fee_amounts = match &decoded_data[9] {
            Token::FixedArray(ref array) => [
                BigInt::from_signed_bytes_be(&array[0].to_uint().unwrap().as_bytes()),
                BigInt::from_signed_bytes_be(&array[1].to_uint().unwrap().as_bytes()),
                BigInt::from_signed_bytes_be(&array[2].to_uint().unwrap().as_bytes()),
            ],
            _ => return Err("invalid fee amounts".to_string()),
        };

        Ok(Self {
            nonce_invalidation_parameters,
            ask_user: decoded_data[1]
                .clone()
                .to_address()
                .unwrap()
                .as_bytes()
                .to_vec(),
            bid_user: decoded_data[2]
                .clone()
                .to_address()
                .unwrap()
                .as_bytes()
                .to_vec(),
            strategy_id: BigInt::from_signed_bytes_be(
                &decoded_data[3].clone().to_uint().unwrap().as_bytes(),
            ),
            currency: decoded_data[4]
                .clone()
                .to_address()
                .unwrap()
                .as_bytes()
                .to_vec(),
            collection: decoded_data[5]
                .clone()
                .to_address()
                .unwrap()
                .as_bytes()
                .to_vec(),
            item_ids,
            amounts,
            fee_recipients,
            fee_amounts,
        })
    }
}

impl TakerBidV2Event {
    // Define the TOPIC_ID for TakerBidV2Event using the provided hash value.
    const TOPIC_ID: [u8; 32] = [
        0x3e, 0xe3, 0xde, 0x46, 0x84, 0x41, 0x36, 0x90, 0xde, 0xe6, 0xff, 0xf1, 0xa0, 0xa4, 0xf9,
        0x29, 0x16, 0xa1, 0xb9, 0x7d, 0x1c, 0x5a, 0x83, 0xcd, 0xf2, 0x46, 0x71, 0x84, 0x43, 0x06,
        0xb2, 0xe3,
    ];

    pub fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        if log.topics.len() != 4usize {
            return false;
        }
        log.topics.get(0).expect("bounds already checked").as_ref() == Self::TOPIC_ID
    }

    // The `decode` function for TakerBidV2Event is very similar to that of TakerAskV2Event.
    // We can use the same logic and just make minor adjustments for the bid_recipient field, which is unique to the TakerBidV2Event.

    pub fn decode(log: &substreams_ethereum::pb::eth::v2::Log) -> Result<Self, String> {
        let data = &log.data;
        let decoded_data: Vec<Token> = ethabi::decode(
            &[
                ethabi::ParamType::Tuple(vec![
                    ethabi::ParamType::Uint(256),
                    ethabi::ParamType::Uint(256),
                    ethabi::ParamType::Uint(256),
                ]),
                ethabi::ParamType::Address,   // bidUser
                ethabi::ParamType::Address,   // bidRecipient
                ethabi::ParamType::Uint(256), // strategyId
                ethabi::ParamType::Address,   // currency
                ethabi::ParamType::Address,   // collection
                ethabi::ParamType::Array(Box::new(ethabi::ParamType::Uint(256))), // itemIds
                ethabi::ParamType::Array(Box::new(ethabi::ParamType::Uint(256))), // amounts
                ethabi::ParamType::FixedArray(Box::new(ethabi::ParamType::Address), 2), // feeRecipients
                ethabi::ParamType::FixedArray(Box::new(ethabi::ParamType::Uint(256)), 3), // feeAmounts
            ],
            &data,
        )
        .map_err(|e| format!("unable to decode data: {:?}", e))?;

        // Extract nonce invalidation parameters
        let nonce_invalidation_parameters = match &decoded_data[0] {
            Token::Tuple(ref tuple) => NonceInvalidationParameters {
                nonce: BigInt::from_signed_bytes_be(
                    &tuple[0].clone().to_uint().unwrap().as_bytes(),
                ),
                minimum_timestamp: tuple[1].clone().to_uint().unwrap().as_u64(),
                maximum_timestamp: tuple[2].clone().to_uint().unwrap().as_u64(),
            },
            _ => return Err("invalid nonce invalidation parameters".to_string()),
        };

        // Extract item_ids
        let item_ids = match &decoded_data[6] {
            Token::Array(ref array) => array
                .iter()
                .map(|token| BigInt::from_signed_bytes_be(&token.to_uint().unwrap().as_bytes()))
                .collect(),
            _ => return Err("invalid item ids".to_string()),
        };

        // Extract amounts
        let amounts = match &decoded_data[7] {
            Token::Array(ref array) => array
                .iter()
                .map(|token| BigInt::from_signed_bytes_be(&token.to_uint().unwrap().as_bytes()))
                .collect(),
            _ => return Err("invalid amounts".to_string()),
        };

        // Extract fee recipients
        let fee_recipients = match &decoded_data[8] {
            Token::FixedArray(ref array) => [
                array[0].clone().to_address().unwrap().as_bytes().to_vec(),
                array[1].clone().to_address().unwrap().as_bytes().to_vec(),
            ],
            _ => return Err("invalid fee recipients".to_string()),
        };

        // Extract fee amounts
        let fee_amounts = match &decoded_data[9] {
            Token::FixedArray(ref array) => [
                BigInt::from_signed_bytes_be(&array[0].to_uint().unwrap().as_bytes()),
                BigInt::from_signed_bytes_be(&array[1].to_uint().unwrap().as_bytes()),
                BigInt::from_signed_bytes_be(&array[2].to_uint().unwrap().as_bytes()),
            ],
            _ => return Err("invalid fee amounts".to_string()),
        };

        Ok(Self {
            nonce_invalidation_parameters,
            bid_user: decoded_data[1]
                .clone()
                .to_address()
                .unwrap()
                .as_bytes()
                .to_vec(),
            bid_recipient: decoded_data[2]
                .clone()
                .to_address()
                .unwrap()
                .as_bytes()
                .to_vec(),
            strategy_id: BigInt::from_signed_bytes_be(
                &decoded_data[3].clone().to_uint().unwrap().as_bytes(),
            ),
            currency: decoded_data[4]
                .clone()
                .to_address()
                .unwrap()
                .as_bytes()
                .to_vec(),
            collection: decoded_data[5]
                .clone()
                .to_address()
                .unwrap()
                .as_bytes()
                .to_vec(),
            item_ids,
            amounts,
            fee_recipients,
            fee_amounts,
        })
    }
}

// Implementations of substreams_ethereum::Event for both TakerAskV2Event and TakerBidV2Event
impl substreams_ethereum::Event for TakerAskV2Event {
    const NAME: &'static str = "TakerAsk";
    fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        Self::match_log(log)
    }
    fn decode(log: &substreams_ethereum::pb::eth::v2::Log) -> Result<Self, String> {
        Self::decode(log)
    }
}

impl substreams_ethereum::Event for TakerBidV2Event {
    const NAME: &'static str = "TakerBid";
    fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        Self::match_log(log)
    }
    fn decode(log: &substreams_ethereum::pb::eth::v2::Log) -> Result<Self, String> {
        Self::decode(log)
    }
}

