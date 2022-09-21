FROM python:3.9

WORKDIR /app

ADD cronjobs/mintrunner/mint.py . 
ADD cronjobs/mintrunner/ProfileAuction.json .
ADD cronjobs/mintrunner/GenesisKey.json .

RUN pip3 install python-dotenv psycopg2 web3

CMD [ "python" , "./mint.py" ]
