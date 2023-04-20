// V1: 0x7f268357A8c2552623316e2562D90e642bB538E5
// V2: 0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b

use substreams::scalar::BigInt;

// Define the OrdersMatched event structure
#[derive(Debug, Clone, PartialEq)]
pub struct OrdersMatchedEvent {
    pub buy_hash: Vec<u8>,
    pub sell_hash: Vec<u8>,
    pub maker: Vec<u8>,
    pub taker: Vec<u8>,
    pub price: BigInt,
    pub metadata: Vec<u8>,
}

impl OrdersMatchedEvent {
    // Define the OrdersMatched event topic ID
    const TOPIC_ID: [u8; 32] = [
        0xc4, 0x10, 0x98, 0x43, 0xe0, 0xb7, 0xd5, 0x14,
        0xe4, 0xc0, 0x93, 0x11, 0x4b, 0x86, 0x3f, 0x8e,
        0x7d, 0x8d, 0x9a, 0x45, 0x8c, 0x37, 0x2c, 0xd5,
        0x1b, 0xfe, 0x52, 0x6b, 0x58, 0x80, 0x06, 0xc9,
    ];

    // Check if the log matches the OrdersMatched event
    pub fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        if log.topics.len() != 6usize {
            return false;
        }
        if log.data.len() != 0usize {
            return false;
        }
        return log.topics.get(0).expect("bounds already checked").as_ref()
            == Self::TOPIC_ID;
    }

    // Decode the log into the OrdersMatched event
    pub fn decode(log: &substreams_ethereum::pb::eth::v2::Log) -> Result<Self, String> {
        let buy_hash = log.topics[1usize].as_ref().to_vec();
        let sell_hash = log.topics[2usize].as_ref().to_vec();
        let maker = log.topics[3usize].as_ref().to_vec();
        let taker = log.topics[4usize].as_ref().to_vec();

        let mut price_bytes = [0u8; 32];
        price_bytes.copy_from_slice(log.topics[5usize].as_ref());
        let price = BigInt::from_signed_bytes_be(&price_bytes);

        let metadata = log.topics[6usize].as_ref().to_vec();

        Ok(Self {
            buy_hash,
            sell_hash,
            maker,
            taker,
            price,
            metadata,
        })
    }
}

impl substreams_ethereum::Event for OrdersMatchedEvent {
    const NAME: &'static str = "OrdersMatched";
    fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        Self::match_log(log)
    }
    fn decode(log: &substreams_ethereum::pb::eth::v2::Log) -> Result<Self, String> {
        Self::decode(log)
    }
}