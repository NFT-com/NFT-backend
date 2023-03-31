import { updateCollectionSales } from './app/sales-processor'

updateCollectionSales().then(() => {
  process.exit()
})
