/* eslint-disable @typescript-eslint/no-unused-vars */
import * as aws from '@pulumi/aws'

import { getResourceName, getStage, joinStringsByDash } from '../helper'

export type sqsOutput = {
    queue: aws.sqs.Queue
}

export const createQueue = () : aws.sqs.Queue => {
    return new aws.sqs.Queue("cross-account-queue", {
        name: getResourceName("cross-account-queue"),
        delaySeconds: 90
    })
}

