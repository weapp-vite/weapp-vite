<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/workers.html -->

## 多线程 Worker

一些异步处理的任务，可以放置于 Worker 中运行，待运行结束后，再把结果返回到小程序主线程。Worker 运行于一个单独的全局上下文与线程中，不能直接调用主线程的方法。

Worker 与主线程之间的数据传输，双方使用 [Worker.postMessage()](https://developers.weixin.qq.com/miniprogram/dev/api/worker/Worker.postMessage.html) 来发送数据， [Worker.onMessage()](https://developers.weixin.qq.com/miniprogram/dev/api/worker/Worker.onMessage.html) 来接收数据，传输的数据并不是直接共享，而是被复制的。

## 使用流程

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/akaQknmy6ZY6)

### 1. 配置 Worker 信息

在 `app.json` 中可配置 `Worker` 代码放置的目录，目录下的所有 JS 代码最终将被打包成一个 JS 文件：

配置示例：

```json
{
  "workers": "workers"
}
```

通过以上方式配置，workers 目录下的所有 JS 文件会被打包为一个 JS 文件，并作为小程序首包的一部分。

小程序首包体积是有上限的（目前为2M），为了使 worker 代码不占用首包体积，从基础库 v2.27.3 开始支持将 worker 代码打包为一个分包。（需要更新开发者工具至最新 nightly 版本）

worker 代码配置为分包示例：

```json
{
  "workers": {
    "path": "workers",
    "isSubpackage": true  // true 表示把 worker 打包为分包。默认 false。填 false 时等同于 { "workers": "workers" }
  }
}
```

### 2. 添加 Worker 代码文件

根据步骤 1 中的配置，在代码目录下新建以下两个入口文件：

```
workers/request/index.js
workers/request/utils.js
workers/response/index.js
```

添加后，目录结构如下：

```
├── app.js
├── app.json
├── project.config.json
└── workers
    ├── request
    │   ├── index.js
    │   └── utils.js
    └── response
        └── index.js
```

### 3. 编写 Worker 代码

在 `workers/request/index.js` 编写 Worker 响应代码

```javascript
const utils = require('./utils')

// 在 Worker 线程执行上下文会全局暴露一个 worker 对象，直接调用 worker.onMessage/postMessage 即可
worker.onMessage(function (res) {
  console.log(res)
})
```

### 4. 在主线程中初始化 Worker

在主线程的代码 app.js 中初始化 Worker

```javascript
const worker = wx.createWorker('workers/request/index.js') // 文件名指定 worker 的入口文件路径，绝对路径
```

从基础库 v2.27.3 开始，如果 worker 代码配置为了分包，则需要先通过 wx.preDownloadSubpackage 接口下载好 worker 代码，再初始化 Worker

```js
var task = wx.preDownloadSubpackage({
   packageType: "workers",
   success(res) {
      console.log("load worker success", res)
      var worker = wx.createWorker("workers/request/index.js")   // 创建 worker。 如果 worker 分包没下载完就调 createWorker 的话将报错
   },
   fail(res) {
      console.log("load worker fail", res)
   }
})

task.onProgressUpdate(res => {
  console.log(res.progress) // 可通过 onProgressUpdate 接口监听下载进度
  console.log(res.totalBytesWritten)
  console.log(res.totalBytesExpectedToWrite)
})
```

### 5. 主线程向 Worker 发送消息

```javascript
worker.postMessage({
  msg: 'hello worker'
})
```

worker 对象的其它接口请看 [worker接口说明](https://developers.weixin.qq.com/miniprogram/dev/api/worker/wx.createWorker.html)

## 注意事项

1. Worker 最大并发数量限制为 1 个，创建下一个前请用 [Worker.terminate()](https://developers.weixin.qq.com/miniprogram/dev/api/worker/Worker.terminate.html) 结束当前 Worker
2. Worker 内代码只能 require 指定 Worker 路径内的文件，无法引用其它路径
3. Worker 的入口文件由 [wx.createWorker()](https://developers.weixin.qq.com/miniprogram/dev/api/worker/wx.createWorker.html) 时指定，开发者可动态指定 Worker 入口文件
4. Worker 内不支持 `wx` 系列的 API
5. Workers 之间不支持发送消息
6. Worker 目录内只支持放置 JS 文件，其他类型的静态文件需要放在 Worker 目录外
7. 基础库 v2.18.1 开始支持在插件内使用 worker。相应地，插件使用worker前需要在 `plugin.json` 内配置 `workers` 代码路径，即一个相对插件代码包根目录的路径。
