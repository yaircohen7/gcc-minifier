const TokenService =  {
     randomToken : async () => {
        const crypto = require('crypto');
        return await crypto.randomBytes(8).toString('hex');
    }
};
module.exports = TokenService;