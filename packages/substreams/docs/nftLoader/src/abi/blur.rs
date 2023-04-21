// Blur Proxy: 0x000000000000ad05ccc4f10045630fb830b95127

use substreams::scalar::BigInt;

#[derive(Debug, Clone, PartialEq)]
pub enum Side {
    Buy,
    Sell,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Fee {
    pub rate: u16,
    pub recipient: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Order {
    pub trader: Vec<u8>,
    pub side: Side,
    pub matching_policy: Vec<u8>,
    pub collection: Vec<u8>,
    pub token_id: BigInt,
    pub amount: BigInt,
    pub payment_token: Vec<u8>,
    pub price: BigInt,
    pub listing_time: BigInt,
    pub expiration_time: BigInt,
    pub fees: Vec<Fee>,
    pub salt: BigInt,
    pub extra_params: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Input {
    pub order: Order,
    pub v: u8,
    pub r: Vec<u8>,
    pub s: Vec<u8>,
    pub extra_signature: Vec<u8>,
    pub signature_version: SignatureVersion,
    pub block_number: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Execution {
    pub sell: Input,
    pub buy: Input,
}

#[derive(Debug, Clone, PartialEq)]
pub struct OrdersMatchedEvent {
    pub execution: Execution,
}

#[derive(Debug, Clone, PartialEq)]
pub struct OrderCancelledEvent {
    pub hash: Vec<u8>,
}

impl OrdersMatchedEvent {
    const TOPIC_ID: [u8; 32] = [
        0x61, 0xcb, 0xb2, 0xa3, 0xde, 0xe0, 0xb6, 0x06,
        0x4c, 0x2e, 0x68, 0x1a, 0xad, 0xd6, 0x16, 0x77,
        0xfb, 0x4e, 0xf3, 0x19, 0xf0, 0xb5, 0x47, 0x50,
        0x8d, 0x49, 0x56, 0x26, 0xf5, 0xa6, 0x2f, 0x64,
    ];

    pub fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        if log.topics.len() != 1usize {
            return false;
        }
        log.topics.get(0).expect("bounds already checked").as_ref() == Self::TOPIC_ID
    }

    pub fn decode(log: &substreams_ethereum::pb::eth::v2::Log) -> Result<Self, String> {
        if !Self::match_log(log) {
            return Err("Log does not match OrdersMatchedEvent".to_string());
        }
        let maker = log.topics.get(1).expect("bounds already checked").as_ref().to_vec();
        let taker = log.topics.get(2).expect("bounds already checked").as_ref().to_vec();

        // Manually decode log data for the Execution struct
        // This is a simplified example, assuming the data is correctly formatted
        // In production, error handling and data validation should be added
        let data = &log.data;
        let sell_order_data = &data[..(data.len() / 2)];
        let buy_order_data = &data[(data.len() / 2)..];

        let sell_order = Order::try_from(sell_order_data)?;
        let buy_order = Order::try_from(buy_order_data)?;

        let execution = Execution {
            sell: Input { order: sell_order, ..Default::default() },
            buy: Input { order: buy_order, ..Default::default() },
        };

        Ok(Self { maker, taker, execution })
    }
}

impl OrderCancelledEvent {
    const TOPIC_ID: [u8; 32] = [
        0x51, 0x52, 0xab, 0xf9, 0x59, 0xf6, 0x56, 0x46,
        0x62, 0x35, 0x8c, 0x2e, 0x52, 0xb7, 0x02, 0x25,
        0x9b, 0x78, 0xba, 0xc5, 0xee, 0x78, 0x42, 0xa0,
        0xf0, 0x19, 0x37, 0xe6, 0x70, 0xef, 0xcc, 0x7d,
    ];

    pub fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        if log.topics.len() != 1usize {
            return false;
        }
        log.topics.get(0).expect("bounds already checked").as_ref() == Self::TOPIC_ID
    }

    pub fn decode(log: &substreams_ethereum::pb::eth::v2::Log) -> Result<Self, String> {
        if !Self::match_log(log) {
            return Err("Log does not match OrderCancelledEvent".to_string());
        }

        let hash = log.topics.get(1).expect("bounds already checked").as_ref().to_vec();
        Ok(Self { hash })
    }
}
