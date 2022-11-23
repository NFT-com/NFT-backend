import http from 'k6/http'
import { addDays } from 'date-fns'
import { Wallet } from 'ethers'

import { helper } from '@nftcom/shared'

const getAuth = async () => {
  const authMessage = 'I\'d like to sign in'
  const privateKey = 'a2f890d2f7023d5eeba7f5c600bd50650ca59bd7e7007af8e016cd7abdc9af5d'
  const signer = new Wallet(privateKey)
  if (!signer) {
    return Promise.reject(new Error('invalid private key'))
  }
  const timestamp = addDays(helper.toUTCDate(), 7)
  const unixTimestamp = Math.floor(timestamp.getTime() / 1000 )
  const signature = await signer.signMessage(`${authMessage} ${unixTimestamp}`)
  return [signature, unixTimestamp]
}
const queryData = JSON.parse(open(`./${__ENV.QUERY_DIR}/queries.json`))

export const options = {
  vus: 5,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // http errors should be less than 1%
    "http_req_duration{rw:read}": ['med<5000'], // median response time must be below 5s
    "http_req_duration{rw:write}": ['med<5000'], // median response time must be below 5s
  },
}

const requests = []
for (const data of queryData) {
  const url = `https://${__ENV.GQL_HOSTNAME}/graphql/`
  const payload = JSON.stringify({
    query: data.query,
    variables: data.variables,
  })
  const [signature, timestamp] = await getAuth()
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'network': 'ethereum',
      'chain-id': '5',
      'authorization': signature,
      timestamp
    },
    tags: {
      rw: data.operation === 'Mutation' ? 'write' : 'read'
    }
  }

  requests.push(['POST', url, payload, params])
}

export default function () {
  const responses = http.batch(requests)

  for (const response of responses) {
    if (response.status >= 400) {
      console.error(`Received HTTP ${response.status} for ${response.url}, body: ${response.body}`);
    }
  }
}