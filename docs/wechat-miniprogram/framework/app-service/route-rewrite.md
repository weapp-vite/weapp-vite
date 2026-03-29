<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/route-rewrite.html -->

# 路由事件重写

从基础库 [3.8.0](../compatibility.md) 起，小程序可以在路由事件下发到基础库但还未进行实际处理之前，改变这次路由事件的目标页面路径及参数。这有一点类似 HTTP 协议中 URL 重定向的效果，但为了不与现有的 *页面重定向* `redirectTo` 混淆，我们将这种新的特性称为 **路由重写（Route rewrite）** 。

> 为了更好地理解这个特性，你可能需要先了解 [路由事件](./route/README.md) 的相关机制

### 兼容性

目前支持：

- 微信安卓客户端 8.0.57 及以上版本
- 微信 iOS 客户端 8.0.61 及以上版本

更多平台适配正在进行中。

另外，有一些 [目前已知的问题](#%E5%B7%B2%E7%9F%A5%E9%97%AE%E9%A2%98) ，也请留意。

在不兼容的客户端或基础库版本上，可以使用 `wx.redirectTo` 进行回退兼容，具体参考下面用法中的代码示例。

## 基本用法

例如，我们可以通过这样的方式将所有跳转到页面 A 的路由都重写到页面 B：

```js
// 添加路由事件处理前的监听
wx.onBeforeAppRoute(res => {
  // 监听触发时，判断事件是否需要重写
  if (res.path === '/pages/A/A') {
    // 重写路由事件
    wx.rewriteRoute({
      url: '/pages/B/B',
      success(res) {
        console.info('Rewrite successfully from A to B')
      },
      fail(res) {
        console.error('Rewrite failed, reason: ' + res.errMsg)
        // 由于兼容性问题或场景不适用等原因重写失败，回退
        wx.redirectTo({
          url: '/pages/B/B',
          complete: console.info
        })
      }
    })
    return
  }
})
```

在这个例子中，如果有一个目标为 `/pages/A/A` 的路由事件（例如 `navigateTo` ）下发到基础库， `wx.onBeforeAppRoute` 监听被触发， `wx.rewriteRoute` 执行重写后， `navigateTo` 的目标将变为 `/pages/B/B` 。最终会有一个 B 页面被实例化并压入页面栈。

### 调用时机

在上面的例子中，路由重写接口 `wx.rewriteRoute` 在 `wx.onBeforeAppRoute` 监听中执行。这是因为路由重写只能在路由事件下发到基础库，并且该路由事件还未被执行任何处理之前进行。换句话说，如果这次路由事件已经产生了实际影响（例如路由使旧页面被弹出销毁或者新页面被渲染），那我们就不能再重写这次路由事件了。因此目前有且只有 `wx.onBeforeAppRoute` 一个时机可以进行路由事件的重写，并且路由重写必须在这个监听的回调中 **同步** 进行。在 `wx.onBeforeAppRoute` 的回调以外的地方进行重写或者在回调中异步进行重写会导致重写失败。

### 目标限制

由于路由重写是改变一个已有路由事件的目标路径，不能改变这个事件的事件类型，因此路由重写需要保证重写后新的目标路径和事件类型是匹配的。例如： `switchTab` 的目标必须是一个 Tab Bar 页面，因此重写也不能将 `switchTab` 事件重写到非 Tab Bar 页面。

### 常见用例

> 此处的代码片段仅做简单的场景演示

1. 页面未找到的情况下，回到小程序主页
  ```js
  wx.onBeforeAppRoute(res => {
    if (res.notFound) {
      wx.rewriteRoute({
        url: '/pages/index/index?from-not-found=' + encodeURIComponent(res.path),
      })
    }
  })
  ```
2. 线下活动结束后，活动页面下线，用户扫描线下旧物料时引导到新活动页；或者线下物料中写错了路径 / 参数，小程序中进行兼容：
  ```js
  wx.onBeforeAppRoute(res => {
    if (res.path === '/pages/old-or-wrong/activity/page') {
      wx.rewriteRoute({
        url: '/pages/new/activity/page',
        preserveQuery: true,
      })
    }
  })
  ```
3. 进入新任务页面时，判断用户是否有上次未完成的任务，继续处理：
  ```js
  wx.onBeforeAppRoute(res => {
    if (res.path === '/pages/task/new-task') {
      const unfinishedTaskId = globalStatus.unfinishedTaskId
      if (typeof unfinishedTaskId === 'string') {
        wx.rewriteRoute({
          url: '/pages/task/perform-task?taskId=' + unfinishedTaskId,
        })
      }
    }
  })
  ```
4. 小程序从首页下拉冷启动时，读取 storage 中存储的不同用户身份（例如顾客与商家、学生与家长等），跳转到不同的首页
  ```js
  wx.onBeforeAppRoute(res => {
    if (res.openType === 'appLaunch') {
      const enterOptions = wx.getEnterOptionsSync()
      if (enterOptions.scene === 1089) {
        const userRole = wx.getStorageSync('user-role')
        if (userRole === 'customer') {
          wx.rewriteRoute({ url: '/pages/customer-index/index' })
        } else if (userRole === 'merchant') {
          wx.rewriteRoute({ url: '/pages/merchant-index/index' })
        } else { /* do nothing */ }
      }
    }
  })
  ```

### 对比页面重定向

从最终结果上来看，路由重写与页面重定向 `redirectTo` 都能达到类似的效果（例如在上面的例子中，最终结果都是新建了一个页面 B 的实例作为栈顶），但二者在执行原理和过程上仍有一定的差别。

页面重定向与原路由事件（例如上例中的 `navigateTo` ）是按顺序排队执行，也就是在执行完页面 A 的渲染任务（例如准备页面渲染环境，实例化页面，处理页面栈逻辑压入页面，渲染页面，触发对应的生命周期等）之后，再处理 `redirectTo` ；而路由重写会在原路由事件下发后处理，框架会直接执行页面 B 的渲染任务。在这个流程中，页面 A 没有被实际实例化或渲染过，因此只渲染了一次页面（ `redirectTo` 实际渲染了两个页面），流程更快、更简单，也更能充分发挥 [WebView 预加载](../performance/tips/runtime_nav.md) 的效果。

当然，也不是所有的 `redirectTo` 都可以被替换为 `rewriteRoute` ，例如需要由用户选择重定向目标或者从其他页面返回后重定向等情况；另一方面， `rewriteRoute` 作为一个新能力，并非所有的用户的运行环境都支持路由重写。开发者可以在适用 `rewriteRoute` 的场景和环境下使用 `rewriteRoute` ，而如果场景不合适或者当前运行环境不支持，则回退使用 `redirectTo` 进行重定向。

### 常见问题

1. **为什么我请求后台接口之后再执行 `rewriteRoute` 会失败？**
  目前小程序提供的网络请求接口都是异步接口，发起网络请求之后，JS 运行时会在等待服务器响应时执行其他任务。因此，请求后台并等待后台接口返回时，路由事件实际上已经被处理和执行了。
  理论上，我们也可以使路由事件的处理和执行等待网络请求返回。在等待期间，由于路由事件尚未处理，用户会持续停留在上一个页面（页面跳转的情况下）或者看到白屏（小程序启动的情况下），而这段时间的长短取决于网络请求的耗时，从而可能导致用户操作打开或跳转后持续没有响应。为了回避这种情况导致的体验恶化，现阶段我们只处理同步进行的路由重写。
2. **为什么 `wx.rewriteRoute` 不像 `navigateTo` 一样可以直接调用，而是要放在监听的回调中？**
  因为相比于 `wx.navigateTo` 是一次路由请求，对应的 `navigateTo` 是一种路由事件类型， `rewriteRoute` 实际上并不是一种路由类型，它的作用是对一次已经存在的路由事件进行一些操作。 `onBeforeAppRoute` 监听会在路由事件下发时触发，在这个回调中我们才能准确地对路由事件进行判断和处理。

### 常见失败及对应原因

- `not supported`
  当前客户端平台或版本不支持路由重写能力
- `rewriteRoute is only allowed in a onBeforeAppRoute callback`
  在不正确的时机调用 `wx.rewriteRoute` （见上方 [调用时机](#%E8%B0%83%E7%94%A8%E6%97%B6%E6%9C%BA) ）
- `rewriteRoute can only be called once in a route event, this page hash been rewritten to "XXX"`
  多次重写了同一个路由事件。每一个路由事件只能被重写一次，可以先计算好最终的目标路径再调用。如果确实需要进行连续的重写，应该等待重写后的路由事件重新触发 `onBeforeAppRoute` 监听回调，再进行重写
- `a "navigateBack" event is not allowed to be rewritten`
  页面返回 `navigateBack` 事件是不能被重写的（因为目标页面是已经存在的原有页面）
- `rewriting a "XXX" event to to a non-tab page("YYY") is not allowed`
- `rewriting a "XXX" event to a tab page("YYY") is not allowed`
  重写后的目标页面与路由事件类型不匹配（见上方 [目标限制](#%E7%9B%AE%E6%A0%87%E9%99%90%E5%88%B6) ）
- `rewriting a route event that belongs to XXX is not allowed.`
  小程序不能重写目标为插件页面的路由事件，反之插件也不能重写目标为小程序或其他插件的路由事件

### 已知问题

1. 目前仅能将路由事件重写到同一分包中的页面，暂不能重写到其他分包的页面。这个问题将在后续的客户端版本中修复
