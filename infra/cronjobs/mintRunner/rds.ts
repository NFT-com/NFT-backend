import * as aws from '@pulumi/aws'

// below resource only configured to be setup in prod
export const createAnalyticsDatabase = (): aws.rds.Instance => {
  const resourceName = 'internal-analytics-db' // static name

  return new aws.rds.Instance('postgres', {
    allocatedStorage: 20,
    backupWindow: '04:30-05:00',
    caCertIdentifier: 'rds-ca-2019',
    dbSubnetGroupName: 'dev-aurora', //public subnets via dev-gql vpc, use in all envs
    engine: 'postgres',
    engineVersion: '14.3',
    identifier: resourceName,
    instanceClass: 'db.t4g.small',
    licenseModel: 'postgresql-license',
    maintenanceWindow: 'fri:07:06-fri:07:36',
    parameterGroupName: 'default.postgres14',
    publiclyAccessible: true,
    skipFinalSnapshot: true,
    storageType: 'gp2',
    name: process.env.ANALYTICS_DB_NAME,
    username: process.env.ANALYTICS_DB_USER,
    password: process.env.ANALYTICS_DB_PASS,
    tags: {
      cronjob: 'mintrunner',
    },
  })
}
