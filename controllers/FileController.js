const fs = require('fs');
const Promise = require("bluebird");
const formidable = require('formidable');
const Gcc = require('../services/GccService');
const TokenService = require('../services/TokenService');
const UPLOAD_PATH = './storage/uploads/';


exports.handleFileUpload = async (req,res) => {

    let token = await TokenService.randomToken();
    let files = await getFiles(req);
    let [source] = await saveFiles(token,files);
    let scriptSummary = await Gcc.runScript(source);

    handleFileUploadResponse(res,token,scriptSummary);
};

exports.listAllFiles = (req,res) => {


    fs.readdirSync(UPLOAD_PATH).forEach(file => {
        console.log(file);
    });
};

const handleFileUploadResponse = (res,token,scriptSummary) => {
    if(scriptSummary.code === 0){
        let data = fs.readFileSync(scriptSummary.target);
        res.writeHead(200, { 'Content-Type': 'text/javascript','X-File-Id':token });
        res.end(data);
        return;
    }
    fs.rmdir(dir, { recursive: true }, (err) => {
        if (err) {
            console.log(`Error while deleting ${dir}`,err);
        }
    });

    if(scriptSummary.code === 2){
        res.writeHead(406, { 'Content-Type': 'text/javascript'});
        res.end(scriptSummary.error.replace(UPLOAD_PATH + token,''));
        return;
    }
    res.writeHead(500, { 'Content-Type': 'text/javascript'});
    res.end('Uknown error');
};



const saveFiles = (token,files)=>{
    console.log('saveFiles');
    let fileName = files.file.name;
    let oldpath = files.file.path;
    let newpath = `${UPLOAD_PATH}/${token}/`;

    if (!fs.existsSync(newpath)) {
        fs.mkdirSync(newpath);
    }
    fs.renameSync(oldpath, newpath + fileName);
    return [newpath + fileName];
};

const getFiles = async (req) => {
    const form = new formidable({ multiples: true });
    form.encoding = 'utf-8';
    let promise = new Promise((resolve, reject) => {
        const form = formidable({ multiples: true });
        form.encoding = 'utf-8';
        form.parse(req, (err, fields, files) => {
            if (err) {
                reject(err);
                return;
            }
            console.log('resolved');
            resolve(files);
            return;
        });
    });
    return await promise;
};