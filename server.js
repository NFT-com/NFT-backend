import { ApolloServer, gql } from 'apollo-server-express';
import express from 'express';
import router from './api/profile/router.mjs';
import dotenv from 'dotenv';


dotenv.config();


//const bodyParser = require('body-parser');


const port = 8080;
const app = express();

/*
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	next();
});
*/

//app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({extended: true}));


//console.log(router);
//console.log(app);
router(app);


app.listen(port);
console.log("Running on port " + port);

