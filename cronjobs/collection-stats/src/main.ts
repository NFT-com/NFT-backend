import { cacheStats } from './app/cache-stats'

cacheStats().then(() => {
  console.log('STATS CACHED!!!')
  process.exit()
})