<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/route-event-listener.html -->

# 页面路由监听

> 基础库 3.5.5 开始支持，低版本需做 [兼容处理](../compatibility.md) 。

这篇指南主要说明从基础库版本 [3.5.5](../compatibility.md) 起可用的 *页面路由事件监听函数* 的使用方法。如果需要了解页面路由的类型及逻辑等基本信息，可以参考 [页面路由](./route/README.md) 。

由于每次路由可能触发多个页面的多个页面生命周期，因此当某个页面的某个生命周期被触发时，小程序往往比较难判断它被触发的原因，从而难以做出一些针对路由（而非针对页面）的响应。一个例子是当小程序进行重加载 `reLaunch` 路由时，小程序可能需要重设一些全局状态来保证后续逻辑正常工作，或者模拟近似于重新启动的效果。然而从页面生命周期来反向推测 `reLaunch` 是比较难的，因为即使某一瞬间当前所有页面都被销毁，也不一定是由 `reLaunch` 引起的（也可能是在仅有单个页面的情况下进行了重定向 `redirectTo` ）。这套接口可以帮助处理这样的场景。

## 所有监听及触发时序

<table><thead><tr><th>页面路由监听</th> <th>触发时机</th> <th>每次路由中的触发次数</th></tr></thead> <tbody><tr><td><a href="../../api/base/app/app-route/wx.onBeforeAppRoute.html"><code>wx.onBeforeAppRoute</code></a></td> <td>路由事件下发到基础库，基础库执行路由逻辑前触发</td> <td>一次</td></tr> <tr><td><a href="../../api/base/app/app-route/wx.onAppRoute.html"><code>wx.onAppRoute</code></a></td> <td>路由事件下发到基础库，基础库执行路由逻辑后触发</td> <td>一次</td></tr> <tr><td><a href="../../api/base/app/app-route/wx.onAppRouteDone.html"><code>wx.onAppRouteDone</code></a></td> <td>路由对应的动画（页面推入、推出等）完成时触发</td> <td>一次</td></tr> <tr><td><a href="../../api/base/app/app-route/wx.onBeforePageLoad.html"><code>wx.onBeforePageLoad</code></a></td> <td>路由引发的页面创建之前触发</td> <td>不限</td></tr> <tr><td><a href="../../api/base/app/app-route/wx.onAfterPageLoad.html"><code>wx.onAfterPageLoad</code></a></td> <td>路由引发的页面创建完成后触发</td> <td>不限</td></tr> <tr><td><a href="../../api/base/app/app-route/wx.onBeforePageUnload.html"><code>wx.onBeforePageUnload</code></a></td> <td>路由引发的页面销毁之前触发</td> <td>不限</td></tr> <tr><td><a href="../../api/base/app/app-route/wx.onAfterPageUnload.html"><code>wx.onAfterPageUnload</code></a></td> <td>路由引发的页面销毁完成后触发</td> <td>不限</td></tr></tbody></table>

例如，在一次 `redirectTo` 中，监听和处理逻辑将按以下顺序触发：

1. [`wx.onBeforeAppRoute`](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.onBeforeAppRoute.html)
2. [`wx.onBeforePageUnload`](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.onBeforePageUnload.html)
3. 旧页面 [`onUnload`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html#%E7%94%9F%E5%91%BD%E5%91%A8%E6%9C%9F%E5%9B%9E%E8%B0%83%E5%87%BD%E6%95%B0) 生命周期
4. 旧页面销毁，此过程中页面本身及页面中所有自定义组件的 [`detached`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Component.html) 生命周期被递归触发
5. 旧页面弹出页面栈，此时开始 [`getCurrentPages`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/getCurrentPages.html) 接口不再能获取到旧页面
6. [`wx.onAfterPageUnload`](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.onAfterPageUnload.html)
7. [`wx.onBeforePageLoad`](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.onBeforePageLoad.html)
8. 创建新页面，此过程中页面本身及页面中所有自定义组件的 [`created`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Component.html) 生命周期被递归触发
9. 新页面压入页面栈，此时开始 [`getCurrentPages`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/getCurrentPages.html) 接口可以获取到新页面
10. 挂载新页面，此过程中页面本身及页面中所有自定义组件的 [`attached`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Component.html) 生命周期被递归触发
11. 新页面 [`onLoad`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html#%E7%94%9F%E5%91%BD%E5%91%A8%E6%9C%9F%E5%9B%9E%E8%B0%83%E5%87%BD%E6%95%B0) 生命周期
12. 新页面 [`onShow`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html#%E7%94%9F%E5%91%BD%E5%91%A8%E6%9C%9F%E5%9B%9E%E8%B0%83%E5%87%BD%E6%95%B0) 生命周期
13. [`wx.onAfterPageLoad`](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.onAfterPageLoad.html)
14. [`wx.onAppRoute`](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.onAppRoute.html)
15. （新页面推入动画完成时） [`wx.onAppRouteDone`](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.onAppRouteDone.html)

对于其他路由，可以结合 [页面路由](./route/README.md) 中的具体路由逻辑进行类推。

## 路由事件 ID

为了在多次监听回调中识别同一个路由事件，框架会为每一次独立的路由事件生成一个在小程序实例中唯一的 ID，称为 *路由事件 ID* 。在所有页面路由监听函数中，事件参数中都将携带一个字符串 `routeEventId` ，表示这个路由事件 ID。小程序可以通过读取回调中的 `routeEventId` ，来将同一个路由在不同时间节点触发的不同回调进行关联。例如：

```javascript
const redirectToContext = {};
wx.onBeforeAppRoute(res => {
  if (res.openType === "redirectTo") {
    redirectToContext[res.routeEventId] = { startTime: new Date() };
  }
});
wx.onBeforePageUnload(res => {
  const context = redirectToContext[res.routeEventId];
  if (context !== undefined) {
    context.from = res.page.is;
    context.data = res.page.data;
  }
});
wx.onAfterPageLoad(res => {
  const context = redirectToContext[res.routeEventId];
  if (context !== undefined) {
    console.log(
      `A "redirectTo" route replaced page "${context.from}" to "${
        res.page.is
      }", which is started at ${context.startTime.toString()}`
    );
    res.page.setData(context.data);
    delete redirectToContext[res.routeEventId];
  }
});
```

这个例子中，我们通过 `routeEventId` 关联了一次 `redirectTo` 中的页面创建和页面销毁：在页面销毁时记录了旧页面的数据，并将其应用到了新页面上。

## 可能的用例

1. 进行路由上报，方便还原用户使用路径：
  ```javascript
  wx.onAppRoute(res => {
    myReportAppRoute(res.timeStamp, res.openType, res.path, res.query);
  });
  ```
2. 小程序冷启动或热启动时，重置所有状态：
  ```javascript
  wx.onBeforeAppRoute(res => {
    if (["appLaunch", "reLaunch", "autoReLaunch"].includes(res.openType)) {
      myGlobalState.reset();
    }
  });
  ```
  这可以解决一些常见情景，例如小程序当前在后台，用户扫码热启动，触发 `autoReLaunch` 时进行状态清理。
3. 新页面创建前先进行网络请求，使页面首屏创建和等待网络请求并行进行：
  ```javascript
  const pageRequestData = {};
  wx.onBeforePageLoad(res => {
    pageRequestData[res.routeEventId] = new Promise((resolve, reject) => {
      wx.request({
        url: `https://mysite.wechat.qq.com/page-data?path=${res.path}&param=${res.query.param}`,
        success(res) {
          resolve(res);
        },
        fail(res) {
          reject(res);
        }
      });
    });
  });
  wx.onAfterPageLoad(res => {
    pageRequestData[res.routeEventId]
      .then(data => {
        res.page.setData(data);
      })
      .catch(err => {
        console.error("page data init error", err);
      });
  });
  ```
  当页面比较复杂时，页面创建需要一定时间。这个做法能充分利用页面的创建时间来等待网络请求返回，从而更快地将业务数据应用到页面上，展示给用户。
