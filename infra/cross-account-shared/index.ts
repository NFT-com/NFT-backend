import * as aws from '@pulumi/aws'

export const create_dev_provider = (): aws.Provider => {
    return new aws.Provider("dev-account-provider", {
        assumeRole: {
            roleArn: "arn:aws:iam::135063527524:role/cicd_cross_account",
            sessionName: "pulumi-target-account-session",
    },
        region: "us-east-1",
    })
}

export const create_prod_provider = (): aws.Provider => {
    return new aws.Provider("immutable", {
        region: "us-east-1"
    })
}

