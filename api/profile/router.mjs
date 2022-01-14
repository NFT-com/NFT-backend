//const { text } = require('body-parser');





const router = app => {

    process.env.PORT;
    app.get('/profile/:id', (req, res) => {
        res.redirect(process.env.URL_API_NFT_URI + req.params.id) 
        }
    );
    
    
}



export default router;