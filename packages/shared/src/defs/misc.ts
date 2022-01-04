export type Chain = {
  id: string
  name: string
}

export type Network = {
  [key: string]: Chain[]
}
