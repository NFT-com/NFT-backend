/* eslint-disable @typescript-eslint/no-unused-vars */
import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

import { getResourceName } from '../helper'

export type sqsOutput = {
    queue: aws.sqs.Queue
}

export const createQueue = (provider : pulumi.provider ) : aws.sqs.Queue => {
    return new aws.sqs.Queue("cross-account-queue", {
        name: getResourceName("cross-account-queue"),
        delaySeconds: 90
    },
    {
        provider: provider
    }
    )
}

