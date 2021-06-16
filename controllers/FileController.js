const fs = require('fs');
const Promise = require("bluebird");
const formidable = require('formidable');
const Gcc = require('../services/GccService');
const TokenService = require('../services/TokenService');

const UPLOAD_PATH = './storage/uploads/';

exports.listAllFiles = async (req,res) => {

    const response = await readFiles(UPLOAD_PATH);
    res.writeHead(200, { 'Content-Type': 'application/json'});
    res.end(JSON.stringify({reponse:response}));

};
exports.handleFileUpload = async (req,res) => {
    let token = await TokenService.randomToken();
    writeFiles(req,res,token);

};
exports.handleFileUpdate = (req,res) => {
    writeFiles(req,res,req.param.token)
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

        if(!files?.file){
            throw 'File not found';
        }

        let [source] = await saveFiles(token,files);
        let scriptSummary = await Gcc.runScript(source);

        handleFileUploadResponse(res,token,scriptSummary);
    }catch (e){
        generalErrorResponse(res,e);
    }
}

const readFiles =  (dir,arrayOfFiles) => {

    const excludeFiles = ['.gitignore'];
    let files = fs.readdirSync(dir)

     arrayOfFiles = arrayOfFiles || {}

    files.forEach(function(file) {
        let stats = fs.statSync(dir + "/" + file);
        if (stats.isDirectory()) {
            arrayOfFiles = readFiles(dir + "/" + file, arrayOfFiles);
        } else {
            if(!excludeFiles.includes(file)){
                let token = dir.replace(`${UPLOAD_PATH}/`,"");
                arrayOfFiles[token] = arrayOfFiles[token] ?? {files:[],timestamps:{cTime:stats.ctimeMs,mTime:stats.mtimeMs}};
                arrayOfFiles[token].files.push(file);
            }
        }
    })

    return arrayOfFiles
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

    let newFileName = files.file.name.replace(/[^a-z0-9\-]/gi, '_').replaceLast('js','.js');
    let oldpath = files.file.path;
    let newpath = `${UPLOAD_PATH}/${token}/`;

    if (!fs.existsSync(newpath)) {
        fs.mkdirSync(newpath);
    }
    fs.renameSync(oldpath, newpath + newFileName);
    return [newpath + newFileName];
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