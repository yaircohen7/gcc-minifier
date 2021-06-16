const fs = require('fs');
const Promise = require("bluebird");
const formidable = require('formidable');
const mime = require('mime-types');
const yauzl = require("yauzl");
const Gcc = require('../services/GccService');
const TokenService = require('../services/TokenService');

const UPLOAD_PATH = './storage/uploads/';
const ALLOWED_FILE_TYPES = ['text/javascript','application/javascript'];

exports.listAllFiles = async (req,res) => {

    const response = await readFiles(UPLOAD_PATH);
    res.writeHead(200, { 'Content-Type': 'application/json'});
    res.end(JSON.stringify({reponse:Object.entries(response)}));

};
exports.handleFileUpload = async (req,res) => {
    let token = await TokenService.randomToken();
    writeFiles(req,res,token);

};
exports.handleFileUpdate = (req,res) => {
    writeFiles(req,res,req.params.token)
};
exports.handleGetItem = async (req,res) => {
    let token = req.params.token;
    console.log('token',token,req.params.token);
    if (!fs.existsSync(UPLOAD_PATH + token)) {
        res.writeHead(404, { 'Content-Type': 'application/json','X-File-Id':token });
        res.end(JSON.stringify({response:'File not found'}));
    }
    const response = await readFiles(UPLOAD_PATH + token,{},true);
    res.writeHead(200, { 'Content-Type': 'text/javascript','X-File-Id':token });
    res.end(JSON.stringify({token:token,content:response}));
    return;
};
exports.handleFileDelete = async (req,res) => {
    fs.rmdir(UPLOAD_PATH + req.params.token, { recursive: true }, (err) => {
        if (err) {
            generalErrorResponse();
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
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

        if(!ALLOWED_FILE_TYPES.includes(mime.lookup('../'+source))){
            deleteFolder(UPLOAD_PATH + token);
            throw 'File not supported';
        }

        let scriptSummary = await Gcc.runScript(source);

        handleFileUploadResponse(res,token,scriptSummary);
    }catch (e){
        generalErrorResponse(res,e);
    }
}

const readFiles =  (dir,arrayOfFiles,withContent = false) => {

    const excludeFiles = ['.gitignore'];
    let files = fs.readdirSync(dir)

     arrayOfFiles = arrayOfFiles || {}

    files.forEach(function(file) {
        let stats = fs.statSync(dir + "/" + file);
        if (stats.isDirectory()) {
            arrayOfFiles = readFiles(dir + "/" + file, arrayOfFiles,withContent);
        } else {
            if(!excludeFiles.includes(file)){
                let token = dir.replace(`${UPLOAD_PATH}/`,"");
                arrayOfFiles[token] = arrayOfFiles[token] ?? {files:[],timestamps:{cTime:stats.ctimeMs,mTime:stats.mtimeMs}};
                if(withContent){
                    arrayOfFiles[token].files.push({name:file,content:String(fs.readFileSync(dir +'/'+file))});
                }else{
                    arrayOfFiles[token].files.push(file);
                }
            }
        }
    })

    return arrayOfFiles
};

const handleFileUploadResponse = (res,token,scriptSummary) => {
    if(scriptSummary.code === 0){
        let data = fs.readFileSync(scriptSummary.target);
        res.writeHead(200, { 'Content-Type': 'text/javascript','X-File-Id':token });
        res.end(JSON.stringify({token:token,content:data}));
        return;
    }

    deleteFolder(UPLOAD_PATH + token);

    if([1,2].includes(scriptSummary.code)){
        res.writeHead(406, { 'Content-Type': 'application/json'});
        let pattern = new RegExp(UPLOAD_PATH + token, "g");
        res.end(JSON.stringify({response:scriptSummary.error.replace(pattern,'')}));
        return;
    }

    generalErrorResponse(res);

};

const deleteFolder = (folder) => {
    fs.rmdir(folder, { recursive: true }, (err) => {
        if (err) {
            console.log(`Error while deleting ${folder}`,err);
        }
    });
};

const saveFiles = async (token,files)=>{

    let newFileName = files.file.name.replace(/[^a-z0-9\-]/gi, '_').replaceLast('js','.js').replaceLast('zip','.zip');
    let oldpath = files.file.path;
    let newpath = `${UPLOAD_PATH}/${token}/`;

    if (!fs.existsSync(newpath)) {
        fs.mkdirSync(newpath);
    }
    fs.renameSync(oldpath, newpath + newFileName);

    if(mime.lookup(newpath + newFileName) === 'application/zip'){
        return handleZipFile(newpath,newFileName);
    }

    return [newpath + newFileName];
};
const handleZipFile = async (newpath,newFileName) => {
    let unzippedName = newFileName.replaceLast('zip','js');

    let promise = new Promise((resolve, reject) => {
        yauzl.open(newpath + newFileName, {lazyEntries: true}, function(err, zipfile) {
            if (err) reject(err);
            zipfile.readEntry();
            zipfile.on("entry", function(entry) {
                if (/\/$/.test(entry.fileName)) {
                    // Directory file names end with '/'.
                    // Note that entries for directories themselves are optional.
                    // An entry's fileName implicitly requires its parent directories to exist.
                    zipfile.readEntry();
                } else {
                    // file entry
                    zipfile.openReadStream(entry, function(err, readStream) {
                        let writeStream = fs.createWriteStream(newpath + unzippedName,{ 'flags': 'a'});
                        if (err) reject(err);
                        readStream.on("end", function() {
                            zipfile.readEntry();
                        });
                        readStream.pipe(writeStream);
                    });
                }
            });
            zipfile.on('end',function(){
                fs.rm(newpath + newFileName,(err)=>console.log(err));
                resolve([newpath + unzippedName]);
            });
        });
    });

    return await promise;
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