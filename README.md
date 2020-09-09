## 背景

在当今`Webpack`横行的时代，`Webpack`的影响力不可谓之不大。对于一个主流`Web`项目的开发而言，大多数时候我们都会采用现有的脚手架作为项目开发或打包工具如：`Vue-cli`、`Cra`，而他们都基于`Webpack`。但是，在不断的使用和日常项目的迭代中，我们慢慢会走入一个窘境，就会出现我们稍微改动一行代码我们就需要等待十几秒甚至是数十秒的情况，这对于我们日益增长的业务开发来说是十分不友好的。

深入`Webpack`打包原理我们可以清晰的知道他的编译过程是静态的，也就是说他会把所有可能用到的代码全部进行打包构建，会借助胶水代码用来组装各模块，这样打包出来的代码是十分庞大的，很多时候其实我们在开发过程中并不需要全部代码的功能，而是一小部分，这个时候大量的构建时间都是多余的，我们需要一个能够真正意义上实现懒加载的开发工具。

带着这样的痛点，我们来看看`Vite`给我们带来了什么。

## Vite是什么

`Vite` 是一个由原生` ESM` 驱动的 `Web` 开发构建工具。在开发环境下基于浏览器原生` ES imports` 开发，在生产环境下基于` Rollup `打包。

它主要具有以下特点：

- 快速的冷启动

- 即时的模块热更新
- 真正的按需编译

其最大的特点是在浏览器端使用 `export`、`import` 的方式导入和导出模块，在 `script` 标签里设置 `type="module"`，浏览器会识别所有添加了`type='module'`的`script`标签，对于该标签中的`import`关键字，浏览器会发起`http`请求获取模块内容。

## 走进Vite原理分析

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

![image-20200909223433589](C:\Users\27505\AppData\Roaming\Typora\typora-user-images\image-20200909223433589.png)

不仅如此，从其他请求中我们也可以看出每一个`.vue`文件都被拆分成了多个请求，并通过`type`来标识是`template`还是`style`。

![image-20200909223250307](C:\Users\27505\AppData\Roaming\Typora\typora-user-images\image-20200909223250307.png)

综上所述，我们可以知道，`vite`在这里做了两件事，第一是修改了模块请求路径，第二就是将`.vue`文件进行解析拆分。

> 上面描述的两件事只是本文会进行详细讲解的有关于`Vite`实现的部分，而不是说`Vite`只干了这两件事👀，`Vite`的功能还是十分强大的。

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

