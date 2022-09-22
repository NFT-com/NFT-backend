# Cronjobs - Infra Details

All cronjobs use the same networking configuration (VPC, Subnets) as GQL by leveraging the GQL Shared Pulumi Stack. Typically a cronjob should have the following cloud resources at a minimum to run: 

- EventBridge: Used for cron-like scheduling to trigger a Lambda or ECS Fargate Task
- ECS Cluster and ECR Repo: If running serverless job via ECS Fargate, will need an ECS Cluster and ECR Repo 
- Lambda Function: If running serverless job via Lambda, will need a respective function 

### Additional Documentation

See extended documentation on how serverless cronjobs are setup via Notion: 
https://www.notion.so/immutableholdings/Running-Serverless-Cronjobs-a132b5d688654fb095bc4a5902546ba8 

