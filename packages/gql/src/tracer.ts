import tracer from 'dd-trace'
if (['development', 'staging', 'production'].includes(process.env.NODE_ENV)) {
  tracer.init({
    profiling: true,
    env: process.env.NODE_ENV,
    service: 'gql',
    logInjection: true,
  })
  tracer.use('http', {
    blocklist: ['/', '/favicon.ico', '/.well-known/apollo/server-health'],
  })
}
export default tracer
