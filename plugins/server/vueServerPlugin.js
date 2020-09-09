const path = require('path');
const { readFile } = require('fs').promises;
const defaultExportRE = /((?:^|\n|;)\s*)export default/

function getCompilerPath(root) {
    const compilerPkgPath = path.join(root, 'node_modules', '@vue/compiler-sfc/package.json');
    const compilerPkg = require(compilerPkgPath);
    // 通过package.json的main能够拿到相关模块的路径
    return path.join(path.dirname(compilerPkgPath), compilerPkg.main);
}

module.exports = function({ app, root }) {
    app.use(async (ctx, next) => {
        const filepath = path.join(root, ctx.path);
        // 处理一下在js中import 'xxx.css'
        if (ctx.path.endsWith('.css')) {
            if (!ctx.query.type) {
                await next();
                ctx.type = 'js';
                ctx.body = `import "${ctx.path}?type=style"`
            } else {
                await next();
                const content = await readFile(filepath, 'utf8');
                ctx.type = 'js';
                ctx.body = `
                    \nconst __css = ${JSON.stringify(content)}
                    \nupdateCss(__css)
                    \nexport default __css
                `
            }
            return;
        }
        if (!ctx.path.endsWith('.vue')) {
            return next();
        }
        // 拿到文件内容
        const content = await readFile(filepath, 'utf8');

        const { parse, compileTemplate } = require(getCompilerPath(root));
        const { descriptor } = parse(content); // 解析文件内容

        if (!ctx.query.type) {
            let code = '';
            if (descriptor.script) {
                let content = descriptor.script.content;
                let replaced = content.replace(defaultExportRE, '$1const __script = ')
                code += replaced;
            }
            if (descriptor.styles.length) {
                descriptor.styles.forEach((item, index) => {
                    code += `\nimport "${ctx.path}?type=style&index=${index}"\n`
                })
            }
            if (descriptor.template) {
                const templateRequest = ctx.path + '?type=template';
                code += `\nimport { render as __render } from ${JSON.stringify(templateRequest)}`;
                code += `\n__script.render = __render`;
            }
            ctx.type = 'js';
            code += `\nexport default __script`;
            ctx.body = code;
        }
        if (ctx.query.type === 'template') {
            ctx.type = 'js';
            let content = descriptor.template.content;
            const { code } = compileTemplate({ source: content });
            ctx.body = code;
        }
        if (ctx.query.type === 'style') {
            const styleBlock = descriptor.styles[ctx.query.index];
            ctx.type = 'js';
            ctx.body = `
                \nconst __css = ${JSON.stringify(styleBlock.content)}
                \nupdateCss(__css)
                \nexport default __css
            `
        }
    })
}