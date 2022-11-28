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
const [timestamp, signature] = __ENV.GQL_AUTH.split(' ')
const url = `https://${__ENV.GQL_HOSTNAME}/graphql/`
for (const data of queryData) {
  const payload = JSON.stringify({
    query: data.query,
    variables: data.variables,
  })
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'network': 'ethereum',
      'chain-id': '5',
      'authorization': signature,
      timestamp,
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