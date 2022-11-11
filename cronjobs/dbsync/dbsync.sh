#!/bin/bash

# Created by Joey Punzel, NFT.com, Nov 2022 
# Script for syncing prod database to staging database
# To be run weekly to keep staging data aligned with prod

# PULL IN ENV VARS (Either .env locally [uncomment if so] or via ECS Task Def)
# export $(grep -v '^#' .env | xargs)

# CONFIGURE AWS ON STARTUP 

aws configure set aws_access_key_id ${AWS_ACCESS_KEY}
aws configure set aws_secret_access_key ${AWS_SECRET_ACCESS_KEY}
aws configure set region ${AWS_REGION}

# DUMP PROD DB

echo ""
echo "Running a pg_dump on prod db"
# Below steps required to tunnel into prod db via ssh socket 

# setup/add ssh key (pull from doppler)
eval $(ssh-agent -s) 
ssh-add <(echo "$PROD_DB_SSH_KEY")

# create an ipv4 tunnel via the prod pastion host 
ssh -o StrictHostKeyChecking=no -4 -M -S my-ctrl-socket -fNT -L 48841:$PROD_DB_HOST:5432 $PROD_DB_BASTION_CONN

# create ssh socket over the tunnel 
ssh -S my-ctrl-socket -O check $PROD_DB_BASTION_CONN

# run the dump via tunnel/socket setup
export PGPASSWORD=$PROD_DB_PASS
pg_dump -U app -h localhost -p 48841 -Fc -v app -f prod-main.db.backup

#close the SSH socket 
ssh -S my-ctrl-socket -O exit $PROD_DB_BASTION_CONN
echo "pg_dump has completed on prod db"

# STOP STAGING SERVICES

echo ""
echo "Stopping Staging GQL & Streams Services"
# stop gql/streams services by bringing desiredCount to 0. Tasks take ~5min to fully stop. 
aws ecs update-service --cluster staging-gql --service staging-gql --desired-count 0 > /dev/null #ignore output
aws ecs update-service --cluster staging-st --service staging-st --desired-count 0 > /dev/null #ignore output

# Check & Stop GQL Task Count 
GQL_TASK_COUNT=`aws ecs list-tasks --cluster staging-gql | grep -c 'arn:aws:ecs:us-east-1:016437323894:task/'`
until [ $GQL_TASK_COUNT -eq 0 ]
do
    GQL_TASK_COUNT=`aws ecs list-tasks --cluster staging-gql | grep -c 'arn:aws:ecs:us-east-1:016437323894:task/'`
    #echo "Current GQL Task Count: ${GQL_TASK_COUNT}. Sleeping 5 and retrying..."  #debugging
    sleep 10
done

# Check & Stop Streams Task Count 
STREAM_TASK_COUNT=`aws ecs list-tasks --cluster staging-st | grep -c 'arn:aws:ecs:us-east-1:016437323894:task/'`
until [ $STREAM_TASK_COUNT -eq 0 ]
do
    STREAM_TASK_COUNT=`aws ecs list-tasks --cluster staging-st | grep -c 'arn:aws:ecs:us-east-1:016437323894:task/'`
    #echo "Current Stream Task Count: ${STREAM_TASK_COUNT}. Sleeping 5 and retrying..."  #debugging
    sleep 10
done
echo "Staging GQL & Streams Services stopped"

# RESTORE STAGING DB

echo ""
echo "Running a pg_restore on staging db"
export PGPASSWORD=$STAGING_DB_PASS
pg_restore -h $STAGING_DB_HOST -p 5432 -U app -d app --clean -Fc prod-main.db.backup
echo "pg_restore has completed on staging db"

# RESUME STAGING SERVICES

echo ""
echo "Starting Staging GQL & Streams Services"
aws ecs update-service --cluster staging-gql --service staging-gql --desired-count 2 > /dev/null
aws ecs update-service --cluster staging-st --service staging-st --desired-count 2 > /dev/null
echo "GQL & Streams Services have started"

echo ""
echo "Script has completed. Exiting.."
exit 0
