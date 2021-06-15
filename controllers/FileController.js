const fs = require('fs');
const { readdir } = require('fs').promises;
const Promise = require("bluebird");
const formidable = require('formidable');
const Gcc = require('../services/GccService');
const TokenService = require('../services/TokenService');

const UPLOAD_PATH = './storage/uploads/';

exports.listAllFiles = async (req,res) => {

    const response = await readFiles(
        UPLOAD_PATH,
    );
    console.log('response', response );

};
exports.handleFileUpload = async (req,res) => {

    let token = await TokenService.randomToken();
    writeFiles(req,res,token);

};
exports.handleFileUpdate = (req,res) => {
    console.log('handleFileUpdate');
    writeFiles(req,res,req.token)
};
exports.handleFileDelete = async (req,res) => {
    fs.rmdir(UPLOAD_PATH + req.params.token, { recursive: true }, (err) => {
        if (err) {
            generalErrorResponse();
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        res.end('success');
    });
};

const writeFiles = async (req,res,token) => {
    try{
        let files = await getFiles(req);

        if(!files.length){
            throw 'File not found';
        }

        let [source] = await saveFiles(token,files);
        let scriptSummary = await Gcc.runScript(source);

        handleFileUploadResponse(res,token,scriptSummary);
    }catch (e){
        generalErrorResponse(res,e);
    }
}

const readFiles = async (dir) => {
    const dirents = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    }));
    return Array.prototype.concat(...files);
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

    generalErrorResponse(res);

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

const generalErrorResponse = (res,msg) => {
    console.log('generalErrorResponse',msg);
    res.writeHead(500, { 'Content-Type': 'text/javascript'});
    res.end(msg ?? 'Uknown error');
};