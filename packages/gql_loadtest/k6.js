import http from 'k6/http'

const queries = JSON.parse(open('./k6-gql-queries.json'))

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // http errors should be less than 1%
    http_req_duration: ['p(95)<500'], // 95 percent of response times must be below 500ms
  },
}

export default function() {
  const url = `https://${__ENV.GQL_HOSTNAME}/graphql/`
  const params = { headers: { 'Content-Type': 'application/json' } }
  http.batch(queries.map(query => {
    return ["POST", url, JSON.stringify({
      query: query.query,
      variables: query.variables,
    }), params]
  }))
}