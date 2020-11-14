
## 背景

在当今`Webpack`横行的时代，`Webpack`的影响力不可谓之不大。对于一个主流`Web`项目的开发而言，大多数时候我们都会采用现有的脚手架作为项目开发或打包工具如：`Vue-cli`、`Cra`，而他们都基于`Webpack`。但是，在不断的使用和日常项目的迭代中，我们慢慢会走入一个窘境，就会出现我们稍微改动一行代码我们就需要等待十几秒甚至是数十秒的情况，这对于我们日益增长的业务开发来说是十分不友好的。

深入`Webpack`打包原理我们可以清晰的知道他的编译过程是静态的，也就是说他会把所有可能用到的代码全部进行打包构建，会借助胶水代码用来组装各模块，这样打包出来的代码是十分庞大的，很多时候其实我们在开发过程中并不需要全部代码的功能，而是一小部分，这个时候大量的构建时间都是多余的，我们需要一个能够真正意义上实现懒加载的开发工具。

带着这样的痛点，我们来看看`Vite`给我们带来了什么。

## Vite 是什么

`Vite` 是一个由原生`ESM` 驱动的 `Web` 开发构建工具。在开发环境下基于浏览器原生`ES imports` 开发，在生产环境下基于`Rollup`打包。

它主要具有以下特点：

- 快速的冷启动

- 即时的模块热更新
- 真正的按需编译

其最大的特点是在浏览器端使用 `export`、`import` 的方式导入和导出模块，在 `script` 标签里设置 `type="module"`，浏览器会识别所有添加了`type='module'`的`script`标签，对于该标签中的`import`关键字，浏览器会发起`http`请求获取模块内容。

## 基本架构

![系统架构图](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ed6a083356014c4c87b59b4cfb9520a6~tplv-k3u1fbpfcp-zoom-1.image)

简易版的`vite`大体结构如上，按照整个流程，我们需要逐一实现这些中间件，实现一个`vite`开发工具。

图中的目标项目即我们开发时的项目，`vite`服务在解析模块路径以及读取文件内容时需要访问目标项目中的模块内容或者配置文件等。

完整项目代码地址：[https://github.com/STDSuperman/my-vite](https://github.com/STDSuperman/my-vite)

## 走进 Vite 原理分析

在开始手撸代码之前，我们先来看看`Vite`如何使用。

首先我们先使用`vite`创建一个`Vue3`项目：

- 方式一：

```shell
$ npm i -g create-vite-app
$ create-vite-app <project-name> （或 cva <project-name>）
$ cd <project-name>
$ npm install
$ npm run dev
```

- 方式二：

```shell
$ npm init vite-app <project-name>
$ cd <project-name>
$ npm install
$ npm run dev
```

启动项目后，我们发现，它在第一次启动时会有一个优化依赖的过程，也就是说第一次启动可能相对而言会慢一点，但是你再次启动时你会发现它的速度基本时毫秒级，完全没有`Webpack`启动项目那般的沉重感。

我们打开对应的网页，就现象上而言，我们几乎没有发现和`Webpack`启动的有什么不一样。接下来，我们打开`Network`，然后刷新页面，我们可以发现，它的请求是不是有点不太一样，不再是`webpack`长长的`bundle`，而是一个个小的请求。

我们点开`main.js`，这个时候你会发现，和我们写的实际代码几乎没有区别，唯一改变的就是部分导入的模块路径被修改了。

![image-20200909223433589](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7d50e044706e4329907106d1d2a263a1~tplv-k3u1fbpfcp-zoom-1.image)

不仅如此，从其他请求中我们也可以看出每一个`.vue`文件都被拆分成了多个请求，并通过`type`来标识是`template`还是`style`。

![image-20200909223250307](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/86475c6eb58e47b993dfe7f374c0227b~tplv-k3u1fbpfcp-zoom-1.image)

综上所述，我们可以知道，`vite`在这里做了两件事，第一是修改了模块请求路径，第二就是将`.vue`文件进行解析拆分。

> 上面描述的两件事只是本文会进行详细讲解的有关于`Vite`实现的部分，而不是说`Vite`只干了这两件事 👀，`Vite`的功能还是十分强大的。

### 开始

我们新建一个项目，开始打造我们自己的`Vite`工具。首先我们先需要实现一个功能，就是如何让我们的 工具在任何一个`Vue3`项目中能使用命令进行启动。

项目目录概览（详细目录文件以实际项目为准）：

- `bin`
  - `www.js`
- `node_modules`
- `plugins`
  - `server`
- `index.js`
- `package.json`

1. 在项目根目录创建`bin`目录，并在`bin`目录下创建一个`www.js`文件，文件内容如下：

```js
#! /usr/bin/env node
const createServer = require('../index');

createServer().listen(4000, () => {
    console.log('app is start port 4000: localhost:4000');
})
```

其实这里也比较简单，实际上是导入根目录`index.js`中暴露的创建服务方法，以`index.js`作为核心逻辑的入口文件，具体的`index.js`文件相关代码下面会进行详细描述。

同时对于如上代码中我们需要注意的点在于头部的一串`#!......`，这里主要是用于声明该文件以`node`环境来执行。

然后我们再将关注点转移到`package.json`描述文件中：

```js
"bin": {
	"molu-vite": "./bin/www.js"
}
```

这里我们暂时只需要关注到这个`bin`对象，在这个对象中声明自定义的命令，以及需要可执行的文件路径。然后在当前项目的根目录终端中输入`npm link`，就这样，我们就可以在我们原先创建的`Vue3`根目录下使用`molu-vite`来开启一个本地服务了。

> 这里的`bin`所在项目是我们独立创建用于实现`vite`的项目，`Vue3`项目是我们上面使用命令行创建的项目，别弄混了...

### 创建服务

刚刚上面我们在`www.js`导入了一个`createServer`方法用于创建服务，接下来我们先来实现这部分代码，打开根目录的`index.js`文件：

```js
const  Koa = require('koa');

module.exports = function createServer() {
    const app = new Koa();
    return app;
}
```

先移除不必要的代码，我们就能清晰看出来，这里使用了`koa`来启动一个简单服务，接下来我们开始逐一实现`vite`的能力。

### 托管静态资源

为了结构清晰，这里将会把相对独立的功能拆分为一个个插件，首先我们需要做的就是将目标项目的内容进行托管，我们在自己的`vite`项目中新建一个文件`plugins/server/serveStaticPlugin.js`，这个文件将导出一个专门用于处理静态资源的方法。

```js
// plugins/server/serveStaticPlugin.js

const  KoaStatic = require('koa-static');
const path = require('path');

module.exports = function(context) {
    const { app, root } = context;
    app.use(KoaStatic(root));
    app.use(KoaStatic(path.resolve(root, 'public')));
}
```

内容也是非常简单，使用了`koa-static`中间件来托管静态资源，同时我们需要拿到`koa`实例（`app`），其次需要获取到目标项目的根目录路径（`root`），将目标项目进行整体托管，同时对于目标项目的 `public`目录也进行托管，这样，我们需要处理的静态文件基本完成了。

接下来就在入口文件`index.js`中引入这个方法：

```js
const  Koa = require('koa');
const serveStaticPlugin = require('./plugins/server/serveStaticPlugin')

module.exports = function createServer() {
    const app = new Koa();
    const root = process.cwd();
    const context = {
        app,
        root
    }
    const resolvePlugins = [
        // 配置静态资源服务
        serveStaticPlugin,
    ]
    resolvePlugins.forEach(f => f(context));
    return app;
}
```

这里我们首先获取目标项目的根目录路径，并与`app`一起作为上下文传给每个插件进行相应处理，这里使用数组存入我们需要执行的插件，然后依次执行，简化代码。

准备工作完成之后，我们就可以开始来解决上面我们留下来的两个问题了：

- 如何修改模块的 引入路径让浏览器能够识别
- 拆分`.vue`文件为多个请求

### 重写模块路径

在进行代码编写前，我们先明确 一点，我们为什么要重写模块路径？

这是因为我们在使用`import`方式导入模块的时候，浏览器只能识别`./`、`../`、`/`这种开头的路径，对于直接使用模块名比如：`import vue from 'vue'`，浏览器就会报错，因为它无法识别这种路径，这就是我们需要进行处理的地方了。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3d2f9094422c4096902f0f1952890c3f~tplv-k3u1fbpfcp-zoom-1.image)

我们先在创建对应的文件`plugins/server/rewriteModulePlugin.js`，并在`index.js`中引入，引入方式同上：

```js
// index.js
const rewriteModulePlugin = require('./plugins/server/rewriteModulePlugin');
...
const resolvePlugins = [
    rewriteModulePlugin
    // 配置静态资源服务
    serveStaticPlugin,
]
```

然后再进入`rewriteModulePlugin.js`：

```js
// rewriteModulePlugin.js
const { readBody } = require('./utils')

function rewriteImports(source) {
    ...
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
```

先从导出的函数开始研究，暂时省略`rewriteImports`，这里我们注册了一个中间件，并使用`await next()`这种方式来获取被后续中间件处理完之后的资源并进行相关操作（`koa`的洋葱模型）。

我们拦截响应的文件，并判断是否是`js`文件，因为只有`js`文件才可能使用`import`方法导入模块，接着读取响应的内容，然后调用重写模块路径的 方法`rewriteImports`并返回给客户端。

这里用到了`readBody`方法，它主要是用于读取文件内容的，相关代码如下：

```js
// util.js
const { Readable } = require('stream');

async function readBody(stream) {
    if (stream instanceof Readable) {
        return new Promise((resolve, reject) => {
            let res = '';
            stream.on('data', (data) => res += data);
            stream.on('end', () => resolve(res));
            stream.on('error', (e) => reject(e));
        })
    } else {
        return stream.toString();
    }
}
```

一般来说，我们在读取`ctx.body`时它经常会以流的形式进行传输，所以我们想要获取完整的内容就需要对流这种信息的内容进行处理，并进行返回，如代码所示，我们监听相应的事件，并获取数据进行拼接，最后返回给调用者，由于是异步的方法，所以这里用到了`Promise`。

当然，如果不是流，而是用`readFile`这种方式读取的内容，我们就直接转为字符串返回就行了。

回到正题，我们继续来看`rewriteImports`这个方法：

```js
// rewriteModulePlugin.js
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
```

这里我们用到了两个第三方包：

#### es-module-lexer

主要用于解析目标字符串中的`import`语句，并将`import`语句后的模块路径的信息解析出来。它是一个 数组，因为一般来说`import`不会只有一个，所以我们可以遍历这个列表来找出不符合要求的模块路径并进行重写。

数组中的每个元素都包含两个属性：`s`（模块路径在字符串中的起始位置）、`e`（模块路径在字符串中结束位置）。比如如下代码，我们以字符串的方式读取出来，传给`es-module-lexer`的`parse`方法，那么返回的结果就是：`[{s: 17, e: 21, ...}]`

```js
import vue from 'vue'
```

`s`其实就是代表后面那个`v`的位置，`e`就代表上面`e`这个字符的后一位。

#### magic-string

这个包主要是用于修改源代码的，也就是用来替换相关的模块路径的工具。

介绍完上面两个包之后其他的代码就比较好理解了，首先我们对`parse`解析完的结果进行遍历，截取模块路径，并进行正则匹配，如果不是以`./`、`../`或`/`开头的，我们就对它进行重写，在对应的模块路径前加上`/@modules`前缀，以便于我们后续进行处理，然后将处理完内容返回给客户端。

重写完请求路径之后，我们就需要在服务端拦截`/@modules`开头的所有请求，并读取相应数据给客户端了。

### 解析模块路径

在处理完所有模块路径之后，我们就需要在服务端来解析模块真实位置。首先新建一个文件`plugins/server/moduleResolvePlugin.js`,在`index.js`中导入：

```js
const moduleResolvePlugin = require('./plugins/server/moduleResolvePlugin');
...
const resolvePlugins = [
    // 重写模块路径
    rewriteModulePlugin
    // 解析模块路径
    moduleResolvePlugin,
    // 配置静态资源服务
    serveStaticPlugin,
]
```

这里需要注意中间件的顺序问题，我们在读取完第三方模块给客户端时，也需要去解析该模块中会引入其他模块，那么它的路径也是需要处理的。

```js
// moduleResolvePlugin.js
const fs = require('fs').promises;
const moduleReg = /^\/@modules\//;
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
```

先来看它的导出方法，从整个结构来看其实也比较好理解，首先正则匹配请求路径，如果是`/@modules`开头就进行后续处理，否则就跳过，并设置响应类型为`js`，读取真实模块路径内容，返回给客户端。这里重点应该在于怎么去获取模块真实路径，也就是代码中`resolveVue`需要做的事情，它会解析出一个真实路径与模块名的映射关系，我们就能通过模块名直接拿到真实路径。

```js
// moduleResolvePlugin.js
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
```

正如注释中写道，`vue3`几个比较核心的包有：`runtime-core` 、`runtime-dom` 、`reactivity` 、`shared`，以及编译`.vue`需要用到的`compiler-sfc`，因为对`vue`单文件解析将由服务端进行处理。

> 这里主要是处理`Vue3`相关的几个核心模块，暂时没有处理其他第三方模块，需要后续对第三方模块也进行解析，其实也比较简单，找出他们在`node_modules`中的入口文件，一般来说都是有规律的，之后只要接收到相关模块的请求就能进行统一读取返回了。

然后我们来看解析过程，由于`compiler-sfc`模块位置与其他几个不一样，所以先单独处理，首先拿到它对应的描述文件`package.json`，通过`main`字段就能知道它的入口文件是哪个：`node_modules/@vue/compiler-sfc/package.json`，然后拼接一下`package.json`所在目录，就能拿到该模块的真实路径了。

对于其他几个`vue`核心模块，由于他们的`es`模块查找规律是一样的，所以抽离一个解析函数`resolvePath`，就能做到统一处理了，这里解释一下为什么要写这么长的路径，因为模块默认导出都是`commonjs`的方式，而这对于浏览器来说是不识别的，所以需要找到对应的`es`模块。

最后返回一个模块与处理好的路径的映射对象，这样我们需要用到的几个模块就能顺利读取了。

> 为什么需要对`vue`的这些模块单独处理一下呢，因为我们在导入`vue`的时候，它的内部会去导这几个核心包，如果不预先进行解析，就无法找到这几个模块的位置，导致项目运行错误。

![image-20200910210115834](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f22947c82c934ae9aa6c4dc7ec2dc597~tplv-k3u1fbpfcp-zoom-1.image)

点开图中`vue`这个模块返回的内容我们可以看到，这几个核心模块都是被包含了的。

### 客户端注入

接下来我们还需要关注一个问题，对于一般的项目来说，我们经常会去使用`process.env`去判断环境，而如果你采用脚手架工具进行开发时`webpack`会来帮我们做这件事，所以在`vite`中我们也需要对它进行一个处理，如果没有这项处理你在运行项目时就会看到这样的报错：

![image-20200910210543937](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b1dcce6c86a94724bc79b12fb0ad0133~tplv-k3u1fbpfcp-zoom-1.image)

它会告诉我们`process`这个变量并没有被定义，所以说我们需要在客户端注入相关的代码。

新建一个文件`plugins/server/htmlRewritePlugin.js`，并在`index.js`中写入：

```js
// index.js
const resolvePlugins = [
        // 重写html，插入需要的代码
        htmlRewritePlugin,
        // 重写模块路径
        rewriteModulePlugin,
        // 解析模块路径
        moduleResolvePlugin,
        // 配置静态资源服务
        serveStaticPlugin,
]
```

同样也需要注意中间件的顺序问题，这个中间件必须处于`serveStaticPlugin`之前，因为需要保证它能够捕捉到`html`相关文件的 请求，这里把它放到第一位。

其实内部实现也非常简单：

> `Talk is cheap. Show me the code.`

```js
const { readBody } = require('./utils')

// 用于处理项目获取环境变量报错问题
module.exports = function ({ root, app }) {
    const inject = `
        <script type='text/javasript'>
            window.process = {
                env: {
                    NODE_ENV: 'development'
                }
            };
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
```

这里其实就是创建一个`script`标签，并在`window`上手动挂载这个全局变量，并把模式置为开发模式，然后将其插入到`head`标签中，这样客户端在解析`html`文件的时候就能将这段代码执行了。

### 解析`.vue`文件

#### 准备

接下来就到我们十分有意思的地方了，深入探究`vite`如何将单文件编译成多个请求的。

首先还是先创建一个文件到`plugins/server`下，并在`index.js`中引入：

```js
// index.js
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
```

在详细研究内部实现之前，我们先需要明确一下需要把它处理成什么样子，这里我们同样打开我们的`vue3`项目地址，找到它对`App.vue`的返回结果：

![image-20200910212716080](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a091b93adfdb4143824f0841b373555f~tplv-k3u1fbpfcp-zoom-1.image)

这里将一个单文件组件分为了几个部分，一个是`script`部分，用一个对象保存，并在下方给该对象添加`render`方法，最后导出这个对象，而这个`render`方法是从导入的，其实它本质上就是获取在服务端解析好的用于渲染单文件组件中`template`标签下的内容的渲染函数。

然后就是将多个`style`标签也在服务端解析出来并在客户端以请求的方式获取。

#### 分类型解析

接下来我们来看代码怎么打造出这样的结构，并处理这几个请求。

```js
// plugins/server/vueServerPlugin.js
function getCompilerPath(root) {
    const compilerPkgPath = path.join(root, 'node_modules', '@vue/compiler-		sfc/package.json');
    const compilerPkg = require(compilerPkgPath);
    // 通过package.json的main能够拿到相关模块的路径
    return path.join(path.dirname(compilerPkgPath), compilerPkg.main);
}
module.exports = function({ app, root }) {
    app.use(async (ctx, next) => {
        const filepath = path.join(root, ctx.path);
       	if (!ctx.path.endsWith('.vue')) {
            return next();
        }
        // 拿到文件内容
        const content = await readFile(filepath, 'utf8');
        const { parse, compileTemplate } = require(getCompilerPath(root));
        const { descriptor } = parse(content); // 解析文件内容
    })
}
```

这里先截取一小部分进行解析，同样注册一个中间件，并判断当前请求的文件是不是`.vue`结尾，因为这个中间件只对单文件组件进行处理，对于非`.vue`文件就直接跳过就行了。

如果是`vue`文件，我们就使用`compiler-sfc`这个模块对该文件进行解析，这里我们暂时只用到了它的两个方法，一个是`parse`，用于解析组件为几个不同部分，第二个就是用来编译`template`内容的方法。

先调用`parse`方法拿到`descriptor`这个对象，它包含了我们所需要的 `script`、`template`、`style`相关数据，下面来看怎么一一解析并返回给客户端。

```js
// plugins/server/vueServerPlugin.js
const defaultExportRE = /((?:^|\n|;)\s*)export default/
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
```

自顶向下看，定义一个`code`变量，用于后续代码拼接。外层先会判断是否是被处理过的请求（被处理后的请求都会存在`query`参数），然后判断`descriptor`上有没有`script`属性（也就是单文件组件中是否存在 `script`标签），如果存在则给`code`变量添加相关代码。

> 我们在看它的处理代码部分前，最好再回想一下我们上面介绍过的一个`vue`组件需要被处理成什么样，

首先拿到解析后的内容，它是一个以`export default`开头的串，所以我们为了达到`vite`处理后的结果，就需要把它替换一下，用一个变量来保存，过程大致如下：

```js
export default {
    ...
}
====>
const __script = {
    ...
}
```

接下来再来处理`style`，同样会先进行判断，它其实是一个数组，因为`style`标签可能会存在多个，所以只要判断一下它的`length`是否大于零，如果大于零就继续往下处理，对于`style`而言，这里不进行详细内容改动，而只是在`code`中添加`import`关键字，将这个`style`以请求的形式在后续进行处理，并在原有路径后面拼接该类型相关的`type`，用于标识该请求的处理方式，并给每个`style`请求代码序号。

相应的，我们再来看`template`的在这里的处理方式，同样不处理它的内容，也是使用`import`方式让浏览器去发起一个新的请求，并在这个请求后面拼接`type`，表明该请求的目标内容，然后拿到导出的`render`函数，并挂载到`__script`对象上。

#### 处理拆解内容

综合上述拆解过程，我们现在对于`style`和`template`类型的请求还没有处理，所以，接下来需要将这部分详细的内容解析完返回给客户端。

对`style`的处理：

```js
// plugins/server/vueServerPlugin.js
if (ctx.query.type === 'style') {
    const styleBlock = descriptor.styles[ctx.query.index];
    ctx.type = 'js';
    ctx.body = `
        \n const __css = ${JSON.stringify(styleBlock.content)}
        \n updateCss(__css)
        \n export default __css
    `
}
```

首先拿到请求的`query`参数中的当前`style`请求的需要，也就是它在`descriptor.styles`中的索引位置，然后就能拿到这个`style`标签内部的内容，接着设置响应类型，再将需要在客户端执行挂载`css`的代码返回给客户端。

这里我们唯一需要关注的点就在于`updateCss`这个方法，它是用来处理`css`的解析的，也是需要预先被注入到客户端，所以我们就需要在之前客户端注入的中间件中加上该方法。

```js
// plugins/server/htmlRewritePlugin.js
const { readBody } = require('./utils')

// 用于处理项目获取环境变量报错问题
module.exports = function ({ root, app }) {
    const inject = `
        <script type='text/javasript'>
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
```

这里的实现实际上十分简单，就直接创建一个`style`标签并添加到`head`头中即可，这样就能让相关`css`生效了。

> 这里主要还是为了先简化逻辑，对于`css`的处理变成`mini`版了 👍。

最后就只剩下处理`template`类型请求了：

```js
// plugins/server/vueServerPlugin.js
if (ctx.query.type === 'template') {
    ctx.type = 'js';
    let content = descriptor.template.content;
    const { code } = compileTemplate({ source: content });
    ctx.body = code;
}
```

首先设置响应类型，表明这是一个`js`文件，然后拿到`descriptor`上的`template`的内容，使用`compiler-sfc`的`compileTemplate`编译一下，拿到最终结果中的`code`，并作为返回体回传给客户端。

自此整个流程基本叙述完毕了。

> _★,°_:.☆(￣ ▽ ￣)/\$:_.°★_ 。撒花。

### 总结

对于整个实现逻辑来看，它的核心流程也比较简单，首先利用了`esm`的特性，让浏览器去做模块导入，真正实现按需加载，不需要在一开始将所有代码都打包加载，这样对于性能很多时候是一种浪费。

正如尤大在推特所说：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5502698906fc4a74abef3ab9ea839059~tplv-k3u1fbpfcp-zoom-1.image)

这可能将时一场新的变革，它对比与`webpack`来说解决了我们在开发过程中静态打包过程，是值得我们去持续关注它的进展，伴随着`vue3`得 推出，`vite`的迭代也是飞速增长，虽然说在一定程度上还未达到能够支持大型项目的程度，但年轻的`vite`最大的优点莫过于它的潜力，虽然`vite`诞生并不久，但是它的理念在一定程度上可能更加符合开发人员的需求。

> 成功不是将来才有的，而是从决定去做的那一刻起，持续累积而成。
