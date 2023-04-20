// 1.1: 0x00000000006c3852cbEf3e08E8dF289169EdE581
// 1.4: 0x00000000000001ad428e4906aE43D8F9852d0dD6

use substreams::scalar::BigInt;

#[derive(Debug, Clone, PartialEq)]
pub enum ItemType {
    Nft,
    Erc20,
    // Additional item types can be added here
}

#[derive(Debug, Clone, PartialEq)]
pub struct OrderItem {
    pub item_type: ItemType,
    pub token: Vec<u8>,
    pub identifier: BigInt,
    pub amount: BigInt,
    pub recipient: Option<Vec<u8>>, // Only used in the "consideration" field
}

#[derive(Debug, Clone, PartialEq)]
pub struct OrderFulfilledEvent {
    pub hash: Vec<u8>,
    pub maker: Vec<u8>,
    pub taker: Vec<u8>,
    pub relayer: Vec<u8>,
    pub items_offered: Vec<OrderItem>,
    pub consideration: Vec<OrderItem>,
}

impl OrderFulfilledEvent {
    const TOPIC_ID: [u8; 32] = [
        0x9d, 0x9a, 0xf8, 0xe3, 0x8d, 0x66, 0xc6, 0x2e,
        0x2c, 0x12, 0xf0, 0x22, 0x52, 0x49, 0xfd, 0x9d,
        0x72, 0x1c, 0x54, 0xb8, 0x3f, 0x48, 0xd9, 0x35,
        0x2c, 0x97, 0xc6, 0xca, 0xcd, 0xcb, 0x6f, 0x31,
    ];

    pub fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        if log.topics.len() != 1usize {
            return false;
        }
        return log.topics.get(0).expect("bounds already checked").as_ref()
            == Self::TOPIC_ID;
    }

    pub fn decode(
        log: &substreams_ethereum::pb::eth::v2::Log,
    ) -> Result<Self, String> {
        // Extract and decode fields from topics
        let hash = log.topics[1usize].as_ref().to_vec();
        let maker = log.topics[2usize].as_ref().to_vec();
        let taker = log.topics[3usize].as_ref().to_vec();
        let relayer = log.topics[4usize].as_ref().to_vec();
        
        // Decode data bytes
        let data = &log.data;
    
        // Use ethabi to decode items_offered and consideration
        let decoded_data: Vec<ethabi::Token> = ethabi::decode(
            &[
                ethabi::ParamType::Array(Box::new(ethabi::ParamType::Tuple(vec![
                    ethabi::ParamType::Uint(8), // item_type
                    ethabi::ParamType::FixedBytes(32), // token
                    ethabi::ParamType::Uint(256), // identifier
                    ethabi::ParamType::Uint(256), // amount
                    ethabi::ParamType::Address, // recipient
                ]))),
                ethabi::ParamType::Array(Box::new(ethabi::ParamType::Tuple(vec![
                    ethabi::ParamType::Uint(8), // item_type
                    ethabi::ParamType::FixedBytes(32), // token
                    ethabi::ParamType::Uint(256), // identifier
                    ethabi::ParamType::Uint(256), // amount
                    ethabi::ParamType::Address, // recipient
                ]))),
            ],
            &data,
        )
        .map_err(|e| format!("unable to decode data: {:?}", e))?;
    
        // Convert decoded_data to items_offered and consideration
        let items_offered: Vec<OrderItem> = decoded_data[0]
            .clone()
            .to_array()
            .unwrap()
            .into_iter()
            .map(|item| {
                let tuple = item.to_tuple().unwrap();
                OrderItem {
                    item_type: match tuple[0].clone().to_uint().unwrap().as_u32() {
                        0 => ItemType::Nft,
                        1 => ItemType::Erc20,
                        _ => unreachable!(),
                    },
                    token: tuple[1].clone().to_fixed_bytes().unwrap(),
                    identifier: BigInt::from_signed_bytes_be(&tuple[2].clone().to_uint().unwrap().as_bytes()),
                    amount: BigInt::from_signed_bytes_be(&tuple[3].clone().to_uint().unwrap().as_bytes()),
                    recipient: tuple[4].clone().to_address().map(|addr| addr.as_bytes().to_vec()),
                }
            })
            .collect();
    
        let consideration: Vec<OrderItem> = decoded_data[1]
            .clone()
            .to_array()
            .unwrap()
            .into_iter()
            .map(|item| {
                let tuple = item.to_tuple().unwrap();
                OrderItem {
                    item_type: match tuple[0].clone().to_uint().unwrap().as_u32() {
                        0 => ItemType::Nft,
                        1 => ItemType::Erc20,
                        _ => unreachable!(),
                    },
                    token: tuple[1].clone().to_fixed_bytes().unwrap(),
                    identifier: BigInt::from_signed_bytes_be(&tuple[2].clone().to_uint().unwrap().as_bytes()),
                    amount: BigInt::from_signed_bytes_be(&tuple[3].clone().to_uint().unwrap().as_bytes()),
                    recipient: tuple[4].clone().to_address().map(|addr| addr.as_bytes().to_vec()),
                }
            })
            .collect();
        
        // Construct and return the OrderFulfilledEvent
        Ok(Self {
            hash,
            maker,
            taker,
            relayer,
            items_offered,
            consideration,
        })
    }
}

impl substreams_ethereum::Event for OrderFulfilledEvent {
    const NAME: &'static str = "OrderFulfilled";
    fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        Self::match_log(log)
    }
    fn decode(
        log: &substreams_ethereum::pb::eth::v2::Log,
    ) -> Result<Self, String> {
        Self::decode(log)
    }
}