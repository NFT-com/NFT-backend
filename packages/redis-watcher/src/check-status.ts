import { ScheduledHandler } from 'aws-lambda'
import Bull from 'bull'
import http from 'node:http'

const prefix = 'queue'
const redis = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
}

const networkList = process.env.SUPPORTED_NETWORKS.replace('ethereum:', '').split(':')
const networks = new Map()
networks.set(
  networkList[0], // chain id
  networkList[1], // human readable network name
)

const notifyGql = (jobName?: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      jobName,
    })

    const options = {
      hostname: process.env.GQL_ELB_URL,
      port: process.env.GQL_ELB_PORT,
      path: '/queue',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }

    const req = http.request(options, (res) => {
      const body = []
      res.on('data', (chunk) => {
        body.push(chunk)
      })
      res.on('end', function () {
        if (res.statusCode < 200 || res.statusCode >= 400) {
          console.error('gql server returned bad response:', body.join(''))
          return reject(res.statusCode)
        }
        resolve(res.statusCode)
      })
    })

    req.on('error', (e) => {
      console.error(`problem with request to gql: ${e.message}`)
      reject(500)
    })

    req.write(postData)
    req.end()
  })
}

const checkRedis = (): number => {
  let statusCode = 200
  try {
    networks.forEach(async (chainId: string) => {
      const bull = new Bull(chainId, {
        prefix,
        redis,
      })
      const jobs = await bull.getJobs(['active', 'completed', 'delayed', 'failed', 'waiting'])
      if (jobs.length) {
        jobs.forEach(async job => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore: @types/bull is outdated
          if (job.isDelayed && job.opts.repeat?.count >= 288) {
            bull.removeRepeatable(job.opts.repeat)
            statusCode = await notifyGql(job.name)
          }
          if (job.isCompleted || job.isFailed) {
            statusCode = 500
            job.remove()
            statusCode = await notifyGql(job.name)
          }
        })
      } else {
        statusCode = await notifyGql()
      }
    })
  } catch (err) {
    console.error('error while checking Redis health:', err)
    statusCode = 500
  }
  return statusCode
}

export const checkStatusHandler: ScheduledHandler = async (): Promise<any> => {
  const statusCode = checkRedis()
  return {
    statusCode,
  }
}