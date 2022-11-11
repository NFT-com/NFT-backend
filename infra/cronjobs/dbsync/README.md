# Cronjob - DBSync - Infra Details

All cronjobs use the same networking configuration (VPC, Subnets) as GQL by leveraging the GQL Shared Pulumi Stack. Typically a cronjob should have the following cloud resources at a minimum to run: 

- EventBridge: Used for cron-like scheduling to trigger a Lambda or ECS Fargate Task
- ECS Cluster and ECR Repo: If running serverless job via ECS, will need an ECS Cluster and ECR Repo 
- Lambda Function: If running serverless job via Lambda, will need a respective function 

The DBSync cronjob uses ECS Fargate to run the serverless job. The goal of the cronjob is to take a backup of the production database, and use this backup to restore on the staging database (thus making staging like prod, or a prod-replica). During the staging restoration, staging services GQL and Streams (ie services connected to staging DB) are brought down to ensure a clean restore. If the services remain up during the restore, it will lead to data inconsistencies (as apps will be writing to db at same time as restore and there will be no constraints during restore). 

## DBSync Specific Infra

- EventBridge
- ECS Cluster / Task
- ECR Repo

This job is scheduled to run weekly, Sundays at 0905 UTC (0400 EST). This is a time when it's okay for staging to go down. 

### 3 Additional Documentation

See extended documentation on how serverless cronjobs are setup via Notion: 
https://www.notion.so/immutableholdings/Running-Serverless-Cronjobs-a132b5d688654fb095bc4a5902546ba8 

