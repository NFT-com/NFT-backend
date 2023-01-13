export type Chain = {
  id: string
  name: string
}

export type Network = {
  [key: string]: Chain[]
}

export const LARGE_COLLECTIONS = [
  '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85',
  '0x06012c8cf97BEaD5deAe237070F9587f8E7A266d',
  '0xD1E5b0FF1287aA9f9A268759062E4Ab08b9Dacbe',
  '0x495f947276749Ce646f68AC8c248420045cb7b5e',
  '0x3B3ee1931Dc30C1957379FAc9aba94D1C48a5405',
  '0x5CC5B05a8A13E3fBDB0BB9FcCd98D38e50F90c38',
  '0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258',
  '0x87E738a3d5E5345d6212D8982205A564289e6324',
  '0x9378368ba6b85c1FbA5b131b530f5F5bEdf21A18',
  '0x999e88075692bCeE3dBC07e7E64cD32f39A1D3ab',
]