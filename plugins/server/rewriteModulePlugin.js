const { readBody } = require('./utils')
const { parse } = require('es-module-lexer');
const MargicString = require('magic-string');

function rewriteImports(source) {
    imports = parse(source)[0];
    magicString = new MargicString(source);
    if (imports.length) {
        imports.forEach(item => {
            const { s, e } = item;
            let id = source.substring(s, e);
            const reg = /^[^\/\.]/
            if (reg.test(id)) {
                id = `/@modules/${id}`;
                magicString.overwrite(s, e, id);
            }
        })
    }
    return magicString.toString();
}

module.exports = function({app, root}) {
    app.use(async (ctx, next) => {
        await next();

        if (ctx.body && ctx.response.is('js')) {
            const content = await readBody(ctx.body);
            ctx.body = rewriteImports(content);
        }
    })
}