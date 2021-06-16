const fs = require('fs');
const Promise = require("bluebird");
const formidable = require('formidable');
const mime = require('mime-types');
const yauzl = require("yauzl");
const Gcc = require('../services/GccService');
const TokenService = require('../services/TokenService');

const UPLOAD_PATH = './storage/uploads/';
const ALLOWED_FILE_TYPES = ['text/javascript','application/javascript'];

// Public methods
exports.handleGetAllItems = async (req,res) => {

    const response = await readFiles(UPLOAD_PATH);
    res.writeHead(200, { 'Content-Type': 'application/json'});
    res.end(JSON.stringify({response:Object.entries(response)}));

};
exports.handleFileUpload = async (req,res) => {
    let token = await TokenService.randomToken();
    let scriptSummary = await writeFiles(req,res,token);
    handleFileUploadResponse(res,token,scriptSummary);
};
exports.handleFileUpdate = async(req,res) => {
    let token = req.params.token;
    await writeFiles(req,res,token);
    getItemsResponse(req,res,token);
};
exports.handleGetItem = async (req,res) => {
    let token = req.params.token;
    console.log('token',token,req.params.token);
    if (!fs.existsSync(UPLOAD_PATH + token)) {
        res.writeHead(404, { 'Content-Type': 'application/json','X-File-Id':token });
        res.end(JSON.stringify({response:'File not found'}));
    }
    getItemsResponse(req,res,token);

};
exports.handleFileDelete = async (req,res) => {
    fs.rmdir(UPLOAD_PATH + req.params.token, { recursive: true }, (err) => {
        if (err) {
            console.log('handleFileDelete',err);
            generalErrorResponse();
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('success');
    });
};

// Responses
const getItemsResponse = async (req,res,token) => {
    const response = await readFiles(UPLOAD_PATH + token,{},true);
    res.writeHead(200, { 'Content-Type': 'application/json','X-File-Id':token });
    res.end(JSON.stringify({token:token,content:response[UPLOAD_PATH + token]}));
};
const handleFileUploadResponse = (res,token,scriptSummary) => {
    if(scriptSummary.code === 0){
        let data = fs.readFileSync(scriptSummary.target);
        res.writeHead(200, { 'Content-Type': 'text/javascript','X-File-Id':token });
        res.end(JSON.stringify({token:token,content:String(data)}));
        return;
    }

    deleteFolder(UPLOAD_PATH + token);

    res.writeHead(406, { 'Content-Type': 'application/json'});
    let pattern = new RegExp(UPLOAD_PATH + token, "g");
    res.end(JSON.stringify({response:scriptSummary.error.replace(pattern,'')}));
    return;


};
const generalErrorResponse = (res,msg) => {
    console.log('generalErrorResponse',msg);
    res.writeHead(500, { 'Content-Type': 'application/json'});
    res.end(JSON.stringify({response:msg ?? 'Unknown error'}));
};

// Files handlers
const getFiles = async (req) => {

    return new Promise((resolve, reject) => {
        const form = formidable({ multiples: true });
        form.encoding = 'utf-8';
        form.parse(req, (err, fields, files) => {
            if (err) {
                reject(err);
            }
            resolve(files);
        });
    }).then((files) => {
        if(!files?.file){
            throw 'File is missing!';
        }
        return files;
    });

};
const writeFiles = async (req,res,token) => {
    try{
        let files = await getFiles(req);

        let [source] = await saveFiles(token,files);

        await checkFileMimeType(source,token);

        return await Gcc.runScript(source);

    }catch (e){
        console.log('error',e);
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
const saveFiles = async (token,files)=>{

    let newFileName = files.file.name.replace(/[^a-z0-9\-.]/gi, '_');
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
const deleteFolder = (folder) => {
    fs.rmdir(folder, { recursive: true }, (err) => {
        if (err) {
            console.log(`Error while deleting ${folder}`,err);
        }
    });
};

// Helpers
const checkFileMimeType = (source,token) => {
    if(!ALLOWED_FILE_TYPES.includes(mime.lookup('../'+source))){
        deleteFolder(UPLOAD_PATH + token);
        throw 'File not supported';
    }
    return;
}
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
