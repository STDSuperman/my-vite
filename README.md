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

我们打开对应的网页，就现象上而言，我们几乎没有发现和`Webpack`启动的有什么不一样。接下来，我们打开`Network`，然后刷新页面，我们可以发现，它的请求是不是有点不太一样，不再是`webpack`长长的`bundle`，而是一个个小的请求。我们点开`main.js`，这个时候你会发现，和我们写的实际代码几乎没有区别，唯一改变的就是部分导入的模块路径被修改了。不仅如此，从其他请求中我们也可以看出每一个`.vue`文件都被拆分成了多个请求，并通过`type`来标识是`template`还是`style`。

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

其实这里也比较简单，实际上是使用根目录`index.js`中暴露的创建服务方法，以`index.js`作为核心逻辑的入口文件，具体的`index.js`文件代码下面会进行详细描述。

同时对于如上代码中我们需要注意的点在于头部的一串`#!......`，这里主要是用于声明该文件以什么环境来执行。

> 未完待续