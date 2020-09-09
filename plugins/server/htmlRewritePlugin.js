const { readBody } = require('./utils')

// 用于处理项目获取环境变量报错问题
module.exports = function ({ root, app }) {
    const inject = `
        <script>
            window.process = {
                env: {
                    NODE_ENV: 'development'
                }
            };

            function updateCss(css) {
                const style = document.createElement('style');
                style.type = 'text/css';
                style.innerHTML = css;
                document.head.appendChild(style);
            }
        </script>
    `
    app.use(async (ctx, next) => {
        await next();
        if (ctx.response.is('html')) {
            let html = await readBody(ctx.body);
            ctx.body = html.replace(/<head>/, `$&${inject}`)
        }
    })
}