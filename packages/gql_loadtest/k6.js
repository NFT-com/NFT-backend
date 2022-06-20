import http from 'k6/http'

const queries = JSON.parse(open('./k6-gql-queries.json'))

export const options = {
  vus: 10,
  duration: '30s'
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