import { addDays } from 'date-fns'
import { Wallet } from 'ethers'

import { helper } from '@nftcom/shared'

const authMessage = "I'd like to sign in"
const defaultKey = 'a2f890d2f7023d5eeba7f5c600bd50650ca59bd7e7007af8e016cd7abdc9af5d'

const main = async (): Promise<void> => {
  const privateKey = process.argv[2] || defaultKey
  const signer = new Wallet(privateKey)
  if (!signer) {
    return Promise.reject(new Error('invalid private key'))
  }
  const timestamp = addDays(helper.toUTCDate(), 7)
  const unixTimestamp = Math.floor(timestamp.getTime() / 1000)
  const signature = await signer.signMessage(`${authMessage} ${unixTimestamp}`)
  console.log('timestamp: ', unixTimestamp)
  console.log('signature: ', signature)
}

main().catch(console.error)
