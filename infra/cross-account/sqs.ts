import * as aws from '@pulumi/aws'

import { getResourceName, getStage, joinStringsByDash } from '../helper'

export type sqsOutput = {
    queue: aws.sqs.queue
}

export const createQueue = () : aws.sqs.queue => {
    return new aws.sqs.Queue("cross-account-queue", {
        name: getResourceName("cross-account-queue"),
        delaySeconds: 90
    })
}

