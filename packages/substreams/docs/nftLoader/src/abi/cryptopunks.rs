use std::convert::TryInto;

fn extract_address_from_topic(topic: &[u8]) -> [u8; 20] {
    let mut address = [0u8; 20];
    address.copy_from_slice(&topic[12..32]);
    address
}

// Define the PunkOfferedEvent struct and implementation
#[derive(Debug, Clone, PartialEq)]
pub struct PunkOfferedEvent {
    pub punk_index: u32,
    pub min_value: u128,
    pub to_address: [u8; 20],
}

impl PunkOfferedEvent {
    const TOPIC_ID: [u8; 32] = [
        0x3c, 0x7b, 0x68, 0x2d, 0x5d, 0xa9, 0x80, 0x01, 0xa9, 0xb8, 0xcb, 0xda, 0x6c, 0x64, 0x7d,
        0x2c, 0x63, 0xd6, 0x98, 0xa4, 0x18, 0x4f, 0xd1, 0xd5, 0x5e, 0x2c, 0xe7, 0xb6, 0x6f, 0x5d,
        0x21, 0xeb,
    ];

    pub fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        log.topics
            .get(0)
            .map_or(false, |topic| topic.as_ref() == Self::TOPIC_ID)
    }

    pub fn decode(log: &substreams_ethereum::pb::eth::v2::Log) -> Result<Self, String> {
        let punk_index = u32::from_be_bytes(log.topics[1].as_ref()[28..32].try_into().unwrap());
        let min_value = u128::from_be_bytes(log.topics[2].as_ref()[16..32].try_into().unwrap());
        let to_address = extract_address_from_topic(log.topics[3].as_ref());
        Ok(Self {
            punk_index,
            min_value,
            to_address,
        })
    }
}

// Define the PunkBidEnteredEvent struct and implementation
#[derive(Debug, Clone, PartialEq)]
pub struct PunkBidEnteredEvent {
    pub punk_index: u32,
    pub value: u128,
    pub from_address: [u8; 20],
}

impl PunkBidEnteredEvent {
    const TOPIC_ID: [u8; 32] = [
        0x5b, 0x85, 0x93, 0x94, 0xfa, 0xba, 0xe0, 0xc1, 0xba, 0x88, 0xba, 0xff, 0xe6, 0x7e, 0x75,
        0x1a, 0xb5, 0x24, 0x8d, 0x2e, 0x87, 0x90, 0x28, 0xb8, 0xc8, 0xd6, 0x89, 0x7b, 0x05, 0x19,
        0xf5, 0x6a,
    ];

    pub fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        log.topics
            .get(0)
            .map_or(false, |topic| topic.as_ref() == Self::TOPIC_ID)
    }

    pub fn decode(log: &substreams_ethereum::pb::eth::v2::Log) -> Result<Self, String> {
        let punk_index = u32::from_be_bytes(log.topics[1].as_ref()[28..32].try_into().unwrap());
        let value = u128::from_be_bytes(log.topics[2].as_ref()[16..32].try_into().unwrap());
        let from_address = extract_address_from_topic(log.topics[3].as_ref());
        Ok(Self {
            punk_index,
            value,
            from_address,
        })
    }
}

// Define the PunkBidWithdrawnEvent struct and implementation
#[derive(Debug, Clone, PartialEq)]
pub struct PunkBidWithdrawnEvent {
    pub punk_index: u32,
    pub value: u128,
    pub from_address: [u8; 20],
}

impl PunkBidWithdrawnEvent {
    const TOPIC_ID: [u8; 32] = [
        0x6f, 0x30, 0xe1, 0xee, 0x4d, 0x81, 0xdc, 0xc7, 0xa8, 0xa4, 0x78, 0x57, 0x7f, 0x65, 0xd2,
        0xed, 0x2e, 0xdb, 0x12, 0x05, 0x65, 0x96, 0x0a, 0xc4, 0x5f, 0xe7, 0xc5, 0x05, 0x51, 0xc8,
        0x79, 0x32,
    ];

    pub fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        log.topics
            .get(0)
            .map_or(false, |topic| topic.as_ref() == Self::TOPIC_ID)
    }

    pub fn decode(log: &substreams_ethereum::pb::eth::v2::Log) -> Result<Self, String> {
        let punk_index = u32::from_be_bytes(log.topics[1].as_ref()[28..32].try_into().unwrap());
        let value = u128::from_be_bytes(log.topics[2].as_ref()[16..32].try_into().unwrap());
        let from_address = extract_address_from_topic(log.topics[3].as_ref());
        Ok(Self {
            punk_index,
            value,
            from_address,
        })
    }
}

// Define the PunkBoughtEvent struct and implementation
#[derive(Debug, Clone, PartialEq)]
pub struct PunkBoughtEvent {
    pub punk_index: u32,
    pub value: u128,
    pub from_address: [u8; 20],
    pub to_address: [u8; 20],
}

impl PunkBoughtEvent {
    const TOPIC_ID: [u8; 32] = [
        0x58, 0xe5, 0xd5, 0xa5, 0x25, 0xe3, 0xb4, 0x0b, 0xc1, 0x5a, 0xba, 0xa3, 0x8b, 0x58, 0x82,
        0x67, 0x8d, 0xb1, 0xee, 0x68, 0xbe, 0xfd, 0x2f, 0x60, 0xba, 0xfe, 0x3a, 0x7f, 0xd0, 0x6d,
        0xb9, 0xe3,
    ];

    pub fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        log.topics
            .get(0)
            .map_or(false, |topic| topic.as_ref() == Self::TOPIC_ID)
    }

    pub fn decode(log: &substreams_ethereum::pb::eth::v2::Log) -> Result<Self, String> {
        let punk_index = u32::from_be_bytes(log.topics[1].as_ref()[28..32].try_into().unwrap());
        let value = u128::from_be_bytes(log.topics[2].as_ref()[16..32].try_into().unwrap());
        let from_address = extract_address_from_topic(log.topics[3].as_ref());
        let to_address = extract_address_from_topic(log.topics[4].as_ref());
        Ok(Self {
            punk_index,
            value,
            from_address,
            to_address,
        })
    }
}

// Define the PunkNoLongerForSaleEvent struct and implementation
#[derive(Debug, Clone, PartialEq)]
pub struct PunkNoLongerForSaleEvent {
    pub punk_index: u32,
}

impl PunkNoLongerForSaleEvent {
    const TOPIC_ID: [u8; 32] = [
        0xb0, 0xe0, 0xa6, 0x60, 0xb4, 0xe5, 0x0f, 0x26, 0xf0, 0xb7, 0xce, 0x75, 0xc2, 0x46, 0x55,
        0xfc, 0x76, 0xcc, 0x66, 0xe3, 0x33, 0x4a, 0x54, 0xff, 0x41, 0x02, 0x77, 0x22, 0x9f, 0xa1,
        0x0b, 0xd4,
    ];

    pub fn match_log(log: &substreams_ethereum::pb::eth::v2::Log) -> bool {
        log.topics
            .get(0)
            .map_or(false, |topic| topic.as_ref() == Self::TOPIC_ID)
    }

    pub fn decode(log: &substreams_ethereum::pb::eth::v2::Log) -> Result<Self, String> {
        let punk_index = u32::from_be_bytes(log.topics[1].as_ref()[28..32].try_into().unwrap());
        Ok(Self { punk_index })
    }
}
