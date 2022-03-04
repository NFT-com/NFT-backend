import { Wallet } from 'ethers'

const authMessage = 'I\'d like to sign in'
const defaultKey = 'dbbda6ab62d2f221e1b8e0ae2ffe65b842635f0ddededbfe64a31f15dc169e83'

const main = async (): Promise<void> => {
  const privateKey = process.argv[2] || defaultKey
  const signer = new Wallet(privateKey)
  if (!signer) {
    return Promise.reject(new Error('invalid private key'))
  }
  const signature = await signer.signMessage(authMessage)
  console.log(signature)
}

main()
  .catch(console.error)
