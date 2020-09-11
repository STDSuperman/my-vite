const  Koa = require('koa');
const serveStaticPlugin = require('./plugins/server/serveStaticPlugin')
const rewriteModulePlugin = require('./plugins/server/rewriteModulePlugin');
const moduleResolvePlugin = require('./plugins/server/moduleResolvePlugin');
const htmlRewritePlugin = require('./plugins/server/htmlRewritePlugin');
const vueServerPlugin = require('./plugins/server/vueServerPlugin')

module.exports = function createServer() {
    const app = new Koa();  
    const root = process.cwd();
    const context = {
        app,
        root
    }
    const resolvePlugins = [
        // 重写html，插入需要的代码
        htmlRewritePlugin,
        // 重写模块路径
        rewriteModulePlugin,
        // 解析.vue文件
        vueServerPlugin,
        // 解析模块路径
        moduleResolvePlugin,
        // 配置静态资源服务
        serveStaticPlugin,
    ]
    resolvePlugins.forEach(f => f(context));
    return app;
}
