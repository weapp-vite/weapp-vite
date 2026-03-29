<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/performance/weak-network.html -->

# 弱网体验优化

在用户使用小程序时，可能会陷入某些网络不通畅的场景，此时一些严格依赖网络的功能可能就无法使用。

## 框架优化

为了让小程序在弱网情况下使用可以更加顺畅，小程序框架做了以下优化来解决弱网使用小程序的体验：

1. 启动小程序支持异步 launch

以前启动的流程是同步 launch，同步时在弱网的时候会出现页面卡在 loading 页的情况，小程序框架在弱网的时候默认使用异步 launch 来优化弱网启动小程序的体验：

- 同步 launch：拉取新的配置、如有新代码包会拉新代码包，再启动小程序；
- 异步 launch：使用默认本地缓存的配置、代码包来启动小程序；

1. 支持弱网/离线一次性授权

对于 wx.getLocation 等需要用户 授权 的接口，因为授权关系会记录在后台，但是在弱网或者断网的时候请求是很难走通的，所以小程序框架在弱网/断网时支持一次性授权的方式来走通流程：

- 调用授权类接口时，不管先前有无授权，都直接弹授权框走本地授权；
- 在弱网/断网这一周期内使用该授权结果；
- 网络恢复后清除掉一次性授权结果，重新走回向后台发请求检查授权的逻辑；

除此之外，小程序提供了 **缓存管理器** 来帮助开发者解决小程序弱网的问题.

目前，以下依赖网络的功能可以通过接入缓存管理器改善：

- 纯展示类的功能
- 只依赖部分用户授权的功能

## 缓存管理器

小程序提供了一个无侵入式的缓存管理器，开发者可以不需要修改原有业务代码进行接入。缓存管理器主要有以下几个能力：

- 在网络通畅时，对符合规则的网络请求进行缓存；在弱网时对该网络请求使用缓存返回。
- 在网络通畅时，对部分 wx api 调用进行缓存；在弱网时对这些 wx api 的调用使用缓存返回。

简单来说，缓存管理器可以帮助开发者在不修改小程序主要逻辑的情况下，快速接入缓存能力。接入过程只需要额外编写如下几行代码：

```js
// 创建缓存管理器
const cacheManager = wx.createCacheManager({
  origin: 'https://weixin.qq.com',
})

// 添加请求规则
cacheManager.addRules([
  '/cgi/home',
  '/cgi/detail/:id',
])

// 监听符合规则的 wx.request 请求，默认在弱网时调用 wx.request 即会触发
cacheManager.on('request', evt => {
  return new Promise((resolve, reject) => {
    // 匹配是否存在缓存
    const matchRes = cacheManager.match(evt)

    if (matchRes && matchRes.data) {
      // 使用缓存返回
      resolve(matchRes.data)
    } else {
      // 没有匹配到缓存
      reject({errMsg: `catch not found: ${evt.url}`})
    }
  })
})
```

上述示例中使用 [wx.createCacheManager](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/wx.createCacheManager.html) 即可创建缓存管理器。缓存管理器全局只有唯一实例，一旦被成功创建出来即表示接入成功。

开发者需要添加请求规则，用来匹配哪些请求需要被缓存，不在请求规则内的请求会被自动放过。一旦请求命中规则，则在网络通畅时会对结果进行缓存，在弱网时会拦截请求，然后触发 request 事件给开发者。开发者可以在事件回调中决定是否使用缓存返回，如果使用缓存返回，则不会再发起网络请求；如果仍要尝试发起网络请求，可像如下方式操作：

```js
cacheManager.on('request', async evt => {
  try {
    // 仍然走网络请求
    const res = await evt.request()

    // ......
  } catch (err) {
    // ......
  }
})
```

为了适应更多的请求场景，请求规则支持多种写法，如：

```js
cacheManager.addRule('/abc') // uri 串，会自动使用调用 wx.createCacheManager 时传入的 origin 进行拼接，然后匹配
cacheManager.addRule('GET /abc') // 在 uri 串基础上，补充请求方法的匹配
cacheManager.addRule('/abc/:id') // 带可变部分的 uri 串

cacheManager.addRule(/\/(abc|cba)$/ig) // 正则表达式

cacheManager.addRule({
  method: 'POST',
  url: '/abc',
  dataSchema: [
    {name: 'param1', schema: {value: /(aaa|bbb)/ig}},
    {name: 'param2', schema: {value: '123'}},
  ],
}) // 规则对象
```

更多规则写法可参考 [addRule 文档](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.addRule.html)

每个命中了规则的请求，会根据一定策略生成缓存 id，如果两个请求生成的缓存 id 相同，则后者会覆盖前者，因此在编写规则时需要注意这点。一般来说，请求 url 不同或请求方法不同，生成的缓存 id 一定不同；如果请求参数不同，则需要考虑命中的规则有没有考虑参数的情况，详细的缓存 id 生成策略可参考 [addRule 文档](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.addRule.html) 。

缓存存储会使用独立的用户空间（不占用用户的 storage），不过有缓存数量和大小限制，所以也不要无节制地使用缓存。请善用规则，尽可能只让必要的请求缓存。

关于缓存管理器的详细使用方式可参考 [api 文档](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.html) 。此处同时提供 [一个完整可运行的例子](https://github.com/wechat-miniprogram/miniprogram-offline-demo) ，参考例子的 README 进行操作即可体验。

## 云托管使用 cacheManager

通过 wx.cloud.callContainer 调用的接口也可以使用 wx.createCacheManager 进行弱网体验优化。缓存请求需要开发者调用 addRule 添加规则。 这里对于 addRule 参数中的 url 字段有个统一规范：https://wx.cloud.callContainer/env/servicename/path ，其中 env / servicename / path 对应 wx.cloud.callContainer 调用服务的标识字段。比如对于如下的云调用，可以按示例添加缓存规则：

```js
const res = await wx.cloud.callContainer({
    config: {
      env: 'test-123'
    },
    path: '/api/count',
    header: {
      'X-WX-SERVICE': 'express-server',
      'content-type': 'application/json'
    },
    method: 'GET',
    data: {
      action: 'inc'
    },
})

// 添加缓存规则
cacheManager.addRule({
    url: 'https://wx.cloud.callContainer/test-123/express-server/api/count',
    method: 'get'
})
```

## 其他

部分 wx api 在接入缓存管理器后也会进行缓存，列表可参考 [wx.createCacheManager](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/wx.createCacheManager.html) 文档，开发者也可以自行调整哪些 wx api 需要缓存。

需要注意的是，如 `wx.login` 、 `wx.checkSession` 等接口支持缓存不等价于该接口在弱网时是可用的，缓存只是将上次成功调用的结果进行返回，接口本身的逻辑并不会改动，也就是说缓存返回中如 `code` 等有时效限制的内容并不会被刷新，仍然会失效。此处的缓存仅为了减少部分场景的改造成本而提供。

其他部分需要用户授权的接口/组件则会在基础库层面支持在弱网使用，用法与之前一样，开发者无需改造。
