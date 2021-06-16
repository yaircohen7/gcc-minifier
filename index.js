const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors')
const app = express();
const port = process.env.PORT ?? 3030;
const file = require('./controllers/FileController');
app.use(cors());

String.prototype.replaceLast = function (what, replacement) {
    let pcs = this.split(what);
    if(pcs.length > 1){
        let lastPc = pcs.pop();
        return pcs.join(what) + replacement + lastPc;
    }
    return this;
};

app.get('/', file.handleGetAllItems);
app.post('/upload', file.handleFileUpload);
app.get('/:token([a-zA-Z0-9]{16})', file.handleGetItem);
app.put('/:token([a-zA-Z0-9]{16})', file.handleFileUpdate);
app.delete('/:token([a-zA-Z0-9]{16})', file.handleFileDelete);

app.use((req, res,next)=>{
    res.status(404).send('Page not found');
});

app.listen(port, () => {
    console.log(`This app is listening at http://localhost:${port}`)
})