const moduleReg = /^\/@modules\//;
const fs = require('fs').promises;
const path = require('path');

function resolveVue(root) {
    // 首先明确一点，vue3几个比较核心的包有：runtime-core runtime-dom reactivity shared
    // 其次我们还需要用到 compiler-sfc 进行后端编译.vue文件
    // 如果需要进行后端编译，我们就需要拿到commonjs规范的模块
    const compilerPkgPath = path.join(root, 'node_modules', '@vue/compiler-sfc/package.json');
    const compilerPkg = require(compilerPkgPath);
    // 通过package.json的main能够拿到相关模块的路径
    const compilerPath = path.join(path.dirname(compilerPkgPath), compilerPkg.main);
    // 用于解析其他模块路径
    const resolvePath = (name) => path.join(root, 'node_modules', `@vue/${name}/dist/${name}.esm-bundler.js`);
    const runtimeCorePath = resolvePath('runtime-core');
    const runtimeDomPath = resolvePath('runtime-dom');
    const reactivityPath = resolvePath('reactivity');
    const sharedPath = resolvePath('shared');
    return {
        compiler: compilerPath,
        '@vue/runtime-dom': runtimeDomPath,
        '@vue/runtime-core': runtimeCorePath,
        '@vue/reactivity': reactivityPath,
        '@vue/shared': sharedPath,
        vue: runtimeDomPath
    }
}

module.exports = function({ app, root }) {
    const vueResolved = resolveVue(root); // 根据vite运行路径解析出所有vue相关模块
    app.use(async (ctx, next) => {
        if (!moduleReg.test(ctx.path)) {
            return next();
        }
        // 去除/@modules/，拿到相关模块
        const id = ctx.path.replace(moduleReg, '');
        ctx.type = 'js'; // 设置响应类型
        const content = await fs.readFile(vueResolved[id], 'utf8');
        ctx.body = content;
    })
}