// V1: 0x59728544B08AB483533076417FbBB2fD0B17CE3a

use substreams::scalar::BigInt;

#[derive(Debug, Clone, PartialEq)]
pub enum TakerEventType {
    TakerBid,
    TakerAsk,
}

// Define a new trait that includes the desired constants
pub trait TakerEventTrait {
    const NAME_BID: &'static str;
    const NAME_ASK: &'static str;
}

// Implement the new trait for the TakerEvent struct
impl TakerEventTrait for TakerEvent {
    const NAME_BID: &'static str = "TakerBid";
    const NAME_ASK: &'static str = "TakerAsk";
}

#[derive(Debug, Clone, PartialEq)]
pub struct TakerEvent {
    pub event_type: TakerEventType,
    pub order_hash: Vec<u8>,
    pub order_nonce: BigInt,
    pub taker: Vec<u8>,
    pub maker: Vec<u8>,
    pub strategy: Vec<u8>,
    pub currency: Vec<u8>,
    pub collection: Vec<u8>,
    pub token_id: BigInt,
    pub amount: BigInt,
    pub price: BigInt,
}

impl TakerEvent {
    const TOPIC_ID_BID: [u8; 32] = [
        0x95, 0xfb, 0x62, 0x05, 0xe2, 0x3f, 0xf6, 0xbd, 0xa1, 0x6a, 0x2d, 0x1d, 0xba, 0x56, 0xb9,
        0xad, 0x7c, 0x78, 0x3f, 0x67, 0xc9, 0x6f, 0xa1, 0x49, 0x78, 0x50, 0x52, 0xf4, 0x76, 0x96,
        0xf2, 0xbe,
    ];

    const TOPIC_ID_ASK: [u8; 32] = [
        0x68, 0xcd, 0x25, 0x1d, 0x4d, 0x26, 0x7c, 0x6e, 0x20, 0x34, 0xff, 0x00, 0x88, 0xb9, 0x90,
        0x35, 0x2b, 0x97, 0xb2, 0x00, 0x2c, 0x04, 0x76, 0x58, 0x7d, 0x0c, 0x4d, 0xa8, 0x89, 0xc1,
        0x13, 0x30,
    ];

    pub fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> Option<TakerEventType> {
        if log.topics.len() != 4usize {
            return None;
        }
        let topic_id = log.topics.get(0).expect("bounds already checked").as_ref();
        if topic_id == Self::TOPIC_ID_BID {
            Some(TakerEventType::TakerBid)
        } else if topic_id == Self::TOPIC_ID_ASK {
            Some(TakerEventType::TakerAsk)
        } else {
            None
        }
    }

    pub fn decode(
        event_type: TakerEventType,
        log: &substreams_ethereum::pb::eth::v2::Log,
    ) -> Result<Self, String> {
        // Decode data bytes
        let data = &log.data;
        // Use ethabi to decode event data
        let decoded_data: Vec<ethabi::Token> = ethabi::decode(
            &[
                ethabi::ParamType::FixedBytes(32), // orderHash
                ethabi::ParamType::Uint(256),      // orderNonce
                ethabi::ParamType::Address,        // taker
                ethabi::ParamType::Address,        // maker
                ethabi::ParamType::Address,        // strategy
                ethabi::ParamType::Address,        // currency
                ethabi::ParamType::Address,        // collection
                ethabi::ParamType::Uint(256),      // tokenId
                ethabi::ParamType::Uint(256),      // amount
                ethabi::ParamType::Uint(256),      // price
            ],
            &data,
        )
        .map_err(|e| format!("unable to decode data: {:?}", e))?;

        // Convert decoded_data to event fields
        Ok(Self {
            event_type,
            order_hash: decoded_data[0].clone().to_fixed_bytes().unwrap(),
            order_nonce: BigInt::from_signed_bytes_be(
                &decoded_data[1].clone().to_uint().unwrap().as_bytes(),
            ),
            taker: decoded_data[2]
                .clone()
                .to_address()
                .unwrap()
                .as_bytes()
                .to_vec(),
            maker: decoded_data[3]
                .clone()
                .to_address()
                .unwrap()
                .as_bytes()
                .to_vec(),
            strategy: decoded_data[4]
                .clone()
                .to_address()
                .unwrap()
                .as_bytes()
                .to_vec(),
            currency: decoded_data[5]
                .clone()
                .to_address()
                .unwrap()
                .as_bytes()
                .to_vec(),
            collection: decoded_data[6]
                .clone()
                .to_address()
                .unwrap()
                .as_bytes()
                .to_vec(),
            token_id: BigInt::from_signed_bytes_be(
                &decoded_data[7].clone().to_uint().unwrap().as_bytes(),
            ),
            amount: BigInt::from_signed_bytes_be(
                &decoded_data[8].clone().to_uint().unwrap().as_bytes(),
            ),
            price: BigInt::from_signed_bytes_be(
                &decoded_data[9].clone().to_uint().unwrap().as_bytes(),
            ),
        })
    }
}

// Implement the substreams_ethereum::Event trait for TakerEvent
impl substreams_ethereum::Event for TakerEvent {
    fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> Option<TakerEventType> {
        Self::match_log(log)
    }

    fn decode(
        event_type: TakerEventType,
        log: &substreams_ethereum::pb::eth::v2::Log,
    ) -> Result<Self, String> {
        Self::decode(event_type, log)
    }
}
