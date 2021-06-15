const GccService = {

    runScript : (source) => {

        let target = source.replaceLast('.js', '.min.js')
        let spawnSync = require('child_process').spawnSync;
        let result = spawnSync('java', ['-jar', '-Xmx512M', '-Dfile.encoding=utf8', 'lib/compiler.jar', source, `--js_output_file`, target]);

        return {
            code: result.status,
            error: String(result.stderr),
            target: target
        };
    }
}
module.exports = GccService;
