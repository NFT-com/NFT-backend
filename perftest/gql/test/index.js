import http from 'k6/http'

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
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'network': 'ethereum',
      'chain-id': '5',
      'authorization': '0x3e28a0402f9a3b2fa2c6ca855cf1335ce9637513af7e5e029f2b78d75b44c5f0233b479a16ca772efcf1574ba593195b8c1164df48825d146a2acef9badc52331c'
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