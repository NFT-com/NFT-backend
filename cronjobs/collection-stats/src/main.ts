import { cacheStats } from './app/cache-stats'

cacheStats().then(() => {
  process.exit()
})
