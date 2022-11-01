export * as db from './db'
export * as entity from './entity'
export * as repository from './repository'

// export migration incase prod-gql not deployed before cronjobs/sales-processor
import { updateCollectionWithStatsColumns1666980059657 } from './migration/1666980059657-updateCollectionWithStatsColumns'
export const migrations = [
  updateCollectionWithStatsColumns1666980059657,
]