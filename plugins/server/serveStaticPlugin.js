const  KoaStatic = require('koa-static');
const path = require('path');

module.exports = function(context) {
    const { app, root } = context;
    app.use(KoaStatic(root));
    app.use(KoaStatic(path.resolve(root, 'public')));
}