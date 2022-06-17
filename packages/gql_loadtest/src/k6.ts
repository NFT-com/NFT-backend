import http from 'k6/http'

const queries = JSON.parse(open('./easygraphql-load-tester-queries.json'))

export default function(): void {
  for (const query of queries) {
    const url = 'https://dev-api.nft.com/graphql/'
    const payload = JSON.stringify({
      query: query.query,
      variables: query.variables,
    })
    const params = { headers: { 'Content-Type': 'application/json' } }
    http.post(url, payload, params)
  }
}