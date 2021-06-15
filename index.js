const express = require('express');
const cors = require('cors')
const app = express();
const port = 3030;
const file = require('./controllers/FileController');
app.use(cors());

String.prototype.replaceLast = function (what, replacement) {
    var pcs = this.split(what);
    var lastPc = pcs.pop();
    return pcs.join(what) + replacement + lastPc;
};

app.get('/', file.listAllFiles)

app.post('/upload', file.handleFileUpload)

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})