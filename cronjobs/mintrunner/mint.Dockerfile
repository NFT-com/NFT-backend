FROM python:3.9

WORKDIR /app

ADD mint.py . 
ADD ../../packages/shared/dist/helper/abis/ProfileAuction.json .
ADD ../../packages/shared/dist/helper/abis/GenesisKey.json .

RUN pip3 install python-dotenv datetime psycopg2 web3

CMD [ "python" , "./mint.py" ]