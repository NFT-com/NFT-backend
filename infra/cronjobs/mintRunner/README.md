# Cronjob - MintRunner - Infra Details

All cronjobs use the same networking configuration (VPC, Subnets) as GQL by leveraging the GQL Shared Pulumi Stack. Typically a cronjob should have the following cloud resources at a minimum to run: 

- EventBridge: Used for cron-like scheduling to trigger a Lambda or ECS Fargate Task
- ECS Cluster and ECR Repo: If running serverless job via ECS, will need an ECS Cluster and ECR Repo 
- Lambda Function: If running serverless job via Lambda, will need a respective function 

## MintRunner Specific Infra

- EventBridge
- ECS Cluster
- ECR Repo
- RDS Instance

MintRunner uses ECS Fargate (not Lambda) to run jobs. Essentially the EventBridge has a cron schedule to run every day at 09:05 UTC to trigger the ECS Fargate task. As the task is just a script, once it completes, the task will come down and thus we only pay for the compute utilized while the task is up. 

To persist analytic data captured by the MintRunner, we also use an RDS instance. To minimize costs, this RDS instance is only created for the production deployment, however the dev/staging MintRunner also point to the prod db for efficiency. While the Prod MintRunner runs daily, the dev/staging run monthly. 

Lastly, there is only 1x ECS Cluster for all MintRunner envs. This was accomplished by creating the ECS Cluster in the dev deployment with a hardcoded name (not env specific), and then importing the ECS Cluster into the Staging/Prod Pulumi stacks. This setup was a one-time effort and should be good moving forward. 

### 3 Additional Documentation

See extended documentation on how serverless cronjobs are setup via Notion: 
https://www.notion.so/immutableholdings/Running-Serverless-Cronjobs-a132b5d688654fb095bc4a5902546ba8 

