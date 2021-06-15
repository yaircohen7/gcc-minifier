const handleFileUpload = async (req,res) => {

    let token = await randomToken();
    let files = await getFiles(req);
    let [source] = await saveFiles(token,files);
    let scriptSummary = await runScript(source);

    handleFileUploadResponse(res,scriptSummary);
};