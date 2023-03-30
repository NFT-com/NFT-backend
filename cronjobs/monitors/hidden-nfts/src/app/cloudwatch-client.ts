import { CloudWatchClient } from '@aws-sdk/client-cloudwatch'
// Set the AWS Region.
const REGION = process.env.AWS_REGION || 'us-east-1'
export const cwClient = new CloudWatchClient({ region: REGION })
