import http from 'k6/http'

const queries = JSON.parse(open('./k6-gql-queries.json'))

export const options = {
  vus: 20,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // http errors should be less than 1%
    http_req_duration: ['p(95)<500'], // 95 percent of response times must be below 500ms
  },
}

export default function() {
  for (const query of queries) {
    const url = `https://${__ENV.GQL_HOSTNAME}/graphql/`
    const payload = JSON.stringify({
      query: query.query,
      variables: query.variables,
    })
    const params = { headers: { 'Content-Type': 'application/json' } }
    http.post(url, payload, params)
  }
}