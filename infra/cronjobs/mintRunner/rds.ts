import * as aws from '@pulumi/aws'

import { getResourceName } from '../../helper'

export const createAnalyticsDatabase = (): aws.rds.Instance => {
  const resourceName = getResourceName('mintrunner')

  return new aws.rds.Instance('postgres', {
    allocatedStorage: 20,
    backupWindow: '04:30-05:00',
    caCertIdentifier: 'rds-ca-2019',
    name: resourceName,
    engine: 'postgres',
    engineVersion: '14.2',
    identifier: resourceName,
    instanceClass: 'db.t4g.small',
    licenseModel: 'postgresql-license',
    maintenanceWindow: 'fri:07:06-fri:07:36',
    parameterGroupName: 'default.postgres14',
    publiclyAccessible: true,
    skipFinalSnapshot: true,
    storageType: 'gp2',
    username: process.env.ANALYTICS_DB_USER,
    password: process.env.ANALYTICS_DB_PASS,
  })
}
