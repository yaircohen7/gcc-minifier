String.prototype.replaceLast = function (what, replacement) {
    var pcs = this.split(what);
    if(pcs.length > 1){
        var lastPc = pcs.pop();
        return pcs.join(what) + replacement + lastPc;
    }
    return this;
};
