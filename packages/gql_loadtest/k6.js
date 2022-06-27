import http from 'k6/http'

const queryData = JSON.parse(open('./k6-gql-queries.json'))

export const options = {
  vus: 4,
  duration: '50s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // http errors should be less than 1%
    "http_req_duration{rw:read}": ['p(95)<500'], // 95 percent of response times must be below 500ms
    "http_req_duration{rw:write}": ['p(95)<3000'], // 95 percent of response times must be below 3s
  },
}

export default function() {
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
        'chain-id': '4',
        'authorization': '0x3e28a0402f9a3b2fa2c6ca855cf1335ce9637513af7e5e029f2b78d75b44c5f0233b479a16ca772efcf1574ba593195b8c1164df48825d146a2acef9badc52331c'
      },
      tags: {
        rw: data.query.contains('mutation') ? 'write' : 'read'
      }
  }
    const res = http.post(url, payload, params)
  }
}