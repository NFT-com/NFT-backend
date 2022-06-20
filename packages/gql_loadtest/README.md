# NFT.com GQL Load Test

## Run test locally

At the moment, queries are only set up to run against dev

```sh
➜  export GQL_HOSTNAME=dev-api.nft.com
➜  npm start
```

## Add Queries

Add query name to list in `src/index.ts`:

```ts
const queries = easyGraphQLLoadTester.createQueries({ selectedQueries: [ ... ] })
```

Add query parameters to `src/args.json`... this is a json object with each of the query names for keys and 
either an object containing the query parameters, or an array of objects supplying multiple different objects 
containing the query parameters.

```json
{
  "collection": {
    "input": {
      "contract": "0xbAE022721cfa57024781c3362724D5fBCE7443Da",
      "network": "rinkeby"
    }
  }
}
```