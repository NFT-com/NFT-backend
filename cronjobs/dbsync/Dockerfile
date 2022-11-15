FROM alpine:latest

WORKDIR /app

ADD cronjobs/dbsync/dbsync.sh . 
RUN chmod +x dbsync.sh

RUN apk add --no-cache aws-cli postgresql-client openssh

CMD [ "sh" , "./dbsync.sh" ]
