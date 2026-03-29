<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/route -->

# 页面路由

在小程序中，所有页面的创建、销毁及状态转换都由页面路由来表达和进行控制。以下内容会简单介绍小程序的页面路由相关逻辑。

## 路由的时机

路由会以事件形式表示，由微信客户端下发给小程序基础库，下发后客户端和基础库将分别同时处理这一次路由事件。路由事件的发起可以大致分为以下两类：

1. 通过用户的操作（如按下返回按钮）发起。通过这种方式发起时，路由事件将直接由客户端下发到基础库执行；
2. 由开发者通过 API（如 `wx.navigateTo` ）或者组件（如 `<navigator>` ）发起。通过这种方式发起时，基础库将首先向客户端发起路由请求，客户端确认路由可以被执行后，再将路由事件下发到基础库。其中，如果路由被确定执行，API 的 `success` 回调函数或组件的 `success` 事件将被触发，否则将触发 `fail` 。

当一次路由被确定执行（API 或组件通知 `success` ）时，没有操作可以取消这一次路由。

当多次路由被连续发起时，如果当前的路由事件还未处理完毕，后续的路由事件将等待当前路由处理，并排队依次执行，直到所有待处理的路由都被执行完毕。

> 一个简单的例子：用户点击返回按钮触发了 `navigateBack` ，小程序在页面栈当前栈顶页的 `onUnload` 中调用 `wx.redirectTo` ， **并不能** 将当前正在被销毁的页面重定向为一个新页面，而是会先完成页面返回，再将页面返回后的新栈顶页重定向到新的页面。

## 页面栈

目前，小程序的页面会被组织为一个页面栈加若干不在栈中的悬垂页面的组合形式。其中，页面栈按顺序存放了通过跳转依次打开的页面，而当前已经创建但非活跃的 tabBar 页面及处于画中画模式（如 [`video`](https://developers.weixin.qq.com/miniprogram/dev/component/video.html#%E5%B0%8F%E7%AA%97%E7%89%B9%E6%80%A7%E8%AF%B4%E6%98%8E) 、 [`live-player`](https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html#%E5%B0%8F%E7%AA%97%E7%89%B9%E6%80%A7%E8%AF%B4%E6%98%8E) 等）中的页面将以悬垂页面的形式存在。

全局接口 [`getCurrentPages`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/getCurrentPages.html) 可以用来获取当前页面栈。

小程序冷启动完成后，在整个小程序存活过程中（除去某次路由执行到一半的中间状态外），页面栈中都将存在至少一个页面。

页面栈的具体行为可以参见下面具体路由行为中的详细描述。

## 路由的监听及响应

### 页面生命周期函数

每个小程序页面都有若干生命周期函数，如 `onLoad` , `onShow` , `onRouteDone` , `onHide` , `onUnload` 等。它们可以在页面注册时定义，并会在相应的时机触发。所有生命周期函数及它们各自的含义和触发时机可以参见 [Page 接口](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html#%E7%94%9F%E5%91%BD%E5%91%A8%E6%9C%9F%E5%9B%9E%E8%B0%83%E5%87%BD%E6%95%B0) ，下面的内容也将详细说明每个路由将如何触发页面的生命周期函数。

### 页面路由监听

从基础库版本 [3.5.5](../../compatibility.md) 开始，基础库提供了一组针对路由事件的监听函数。相比页面生命周期函数，它们能更好地针对某次路由进行响应。详见 [页面路由监听](../route-event-listener/README.md) 。

## 路由类型

小程序目前的路由类型可以大致分为以下七种：

### 1. 小程序启动

- openType: `appLaunch`

小程序启动路由 `appLaunch` 表示一个新的小程序启动，并加载第一个页面。 `appLaunch` 在每个小程序实例中会且仅会出现一次，且每个小程序实例启动时的第一个路由事件必定为 `appLaunch` 。

**触发方式**

`appLaunch` 仅能由小程序冷启动被动触发，不能由开发者主动触发，启动后也不能通过其他用户操作触发。

**页面栈及生命周期处理**

由于 `appLaunch` 必定是启动时的第一个路由，而路由前没有任何页面存在，此时页面栈必定为空。 `appLaunch` 会创建路由事件指定的页面，并将其推入页面栈作为栈中唯一的页面。在这个过程中，这个页面的 `onLoad` , `onShow` 两个生命周期将依次被触发。

### 2. 打开新页面

- openType: `navigateTo`

打开新页面路由 `navigateTo` 表示打开一个新的页面，并将其推入页面栈。

**触发方式**

1. 调用 API [`wx.navigateTo`](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.navigateTo.html) , [`Router.navigateTo`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Router.html)
2. 使用组件 [`<navigator open-type="navigateTo"/>`](https://developers.weixin.qq.com/miniprogram/dev/component/navigator.html)
3. 用户点击一个视频小窗（如 [`video`](https://developers.weixin.qq.com/miniprogram/dev/component/video.html#%E5%B0%8F%E7%AA%97%E7%89%B9%E6%80%A7%E8%AF%B4%E6%98%8E) ）

`navigateTo` 的目标必须为非 tabBar 页面。

**页面栈及生命周期处理**

`navigateTo` 事件发生时，页面栈当前的栈顶页面将首先被隐藏，触发 `onHide` 生命周期；之后框架将创建路由事件指定的页面，并将其推入页面栈作为新的栈顶。在这个过程中，这个新页面的 `onLoad` , `onShow` 两个生命周期将依次被触发。

作为一种特殊情况，如果 `navigateTo` 事件发生时，页面栈当前的栈顶页面满足小窗模式逻辑，或事件由用户点击视频小窗发起，那么页面栈及生命周期的的处理会有所不同。

### 3. 页面重定向

- openType: `redirectTo`

页面重定向路由 `redirectTo` 表示将页面栈当前的栈顶页面替换为一个新的页面。

**触发方式**

1. 调用 API [`wx.redirectTo`](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.redirectTo.html) , [`Router.redirectTo`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Router.html)
2. 使用组件 [`<navigator open-type="redirectTo"/>`](https://developers.weixin.qq.com/miniprogram/dev/component/navigator.html)

`redirectTo` 的目标必须为非 tabBar 页面。

**页面栈及生命周期处理**

`redirectTo` 事件发生时，页面栈当前的栈顶页面将首先被弹出并销毁，在此过程中，这个栈顶页面的 `onUnload` 生命周期将被触发；之后框架将创建路由事件指定的页面，并将其推入页面栈作为新的栈顶。在这个过程中，这个新页面的 `onLoad` , `onShow` 两个生命周期将依次被触发。

### 4. 页面返回

- openType: `navigateBack`

页面返回路由 `navigateBack` 表示将页面栈当前的栈顶的若干个页面依次弹出并销毁。

**触发方式**

1. 调用 API [`wx.navigateBack`](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.navigateBack.html) , [`Router.navigateBack`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Router.html)
2. 使用组件 [`<navigator open-type="navigateBack"/>`](https://developers.weixin.qq.com/miniprogram/dev/component/navigator.html)
3. 用户按左上角返回按钮，或触发操作系统返回的动作（如按下系统返回键、屏幕边缘向内滑动等）
4. 用户点击一个视频小窗（如 [`video`](https://developers.weixin.qq.com/miniprogram/dev/component/video.html#%E5%B0%8F%E7%AA%97%E7%89%B9%E6%80%A7%E8%AF%B4%E6%98%8E) ）

如果页面栈中当前只有一个页面， `navigateBack` 调用请求将失败（无论指定的 `delta` 是多少）；

如果页面栈中当前的页面数量少于调用时指定的 `delta` + 1（即调用后页面数量将少于一个）， `navigateBack` 将弹出到只剩页面栈当前的页面栈底的页面为止（即至少保留一个页面）。

**页面栈及生命周期处理**

`navigateBack` 事件发生时，页面栈当前的栈顶页面将被弹出并销毁，并触发这个页面的 `onUnload` 生命周期；以上操作将被重复执行多次，直到弹出的页面数量等于指定的页面数量，或当前页面栈中只剩下一个页面。之后，页面栈新的栈顶页面的 `onShow` 生命周期将被触发。

一种特殊情况是，如果 `navigateBack` 发生时，页面栈当前的栈顶页面满足小窗模式逻辑，或事件由用户点击视频小窗发起，那么页面栈及生命周期的的处理会有所不同。

### 5. Tab 切换

- openType: `switchTab`

Tab 切换路由 `switchTab` 表示切换到指定的 tab 页面。

**触发方式**

1. 调用 API [`wx.switchTab`](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.switchTab.html) , [`Router.switchTab`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Router.html)
2. 使用组件 [`<navigator open-type="switchTab"/>`](https://developers.weixin.qq.com/miniprogram/dev/component/navigator.html)
3. 用户点击 Tab Bar 中的 Tab 按钮

`switchTab` 的目标必须为 tabBar 页面。

**页面栈及生命周期处理**

由于 `navigateTo` 和 `redirectTo` 不能指定 tabBar 页面作为目标，因此当一个 tabBar 页面出现在页面栈中时，它必定为页面栈的第一个页面（即栈底页面）；同时，框架会保证任一 tabBar 页面在小程序中最多同时存在一个页面实例。 `switchTab` 的行为主要基于这两点进行。

`switchTab` 事件发生时，如果当前页面栈中存在多于一个页面，页面栈当前的栈顶页面将被弹出并销毁，并触发这个页面的 `onUnload` 生命周期；以上操作将被重复执行多次，直到页面栈中只剩下一个页面。之后，根据页面栈中仅剩的页面进行不同的处理：

- 如果这个页面即为目标 tabBar 页面：
    - 如果路由事件开始时页面栈中存在多于一个页面（即目标 tabBar 页面不是栈顶页面），触发目标 tabBar 页面的 `onShow` 生命周期；
    - 否则（路由事件开始时目标 tabBar 页面是栈顶页面），不触发任何生命周期，直接结束；
- 否则（该页面不为目标 tabBar 页面时）：
    1. 将这个页面从页面栈中弹出；
    2.     - 如果这个页面为其他 tabBar 页面，该页面成为悬垂页面，并：
                  - 如果路由事件开始时页面栈中只有一个页面（即该 tabBar 页面是栈顶页面），触发它的 `onHide` 生命周期；
                  - 否则（路由事件开始时该 tabBar 页面不是栈顶页面），不触发它的任何生命周期；
          - 否则（这个页面为非 tabBar 页面时），销毁该页面，触发 `onUnload` 生命周期；
    3.     - 如果目标 tabBar 页之前已经被创建过（现在是一个悬垂页面），将其推入页面栈，触发 `onShow` 生命周期；
          - 否则（目标 tabBar 页不存在实例），创建目标 tabBar 页并推入页面栈，依次触发 `onLoad` , `onShow` 生命周期。

### 6. 重加载

- openType: `reLaunch` , `autoReLaunch`

重加载路由 `reLaunch` 或 `autoReLaunch` 表示销毁当前所有的页面，并载入一个新页面。

重加载路由的两种 openType 的区别主要为是否由开发者主动触发（或是由用户触发），这两种 openType 的路由逻辑基本一致。

**触发方式**

1. （ `reLaunch` ）调用 API [`wx.reLaunch`](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.reLaunch.html) , [`Router.reLaunch`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Router.html)
2. （ `reLaunch` ）使用组件 [`<navigator open-type="reLaunch"/>`](https://developers.weixin.qq.com/miniprogram/dev/component/navigator.html)
3. （ `autoReLaunch` ）小程序处于后台时，用户从扫码或分享等场景重新进入小程序

`reLaunch` 可以指定任意页面作为目标页面，无论它是否是小程序的首页或是否 tabBar 页。

请注意： `reLaunch` 及 `autoReLaunch` 仅代表一种路由， **并不等于小程序重启，小程序会在当前的 AppService 上继续运行** ，既不会重新启动 AppService 的 JavaScript 运行环境，也不会重新注入小程序代码或触发 `App.onLaunch` 生命周期，各种 JS 的全局变量或全局状态也不会被重置。

**页面栈及生命周期处理**

`reLaunch` 或 `autoReLaunch` 事件发生时，页面栈中的所有页面将由顶至底依次被弹出并销毁，触发 `onUnload` 生命周期；之后所有悬垂页面将以不确定的顺序逐个被销毁，触发 `onUnload` 生命周期。所有页面都被销毁后，目标页面将被创建，并推入页面栈成为栈中唯一的页面，依次触发 `onLoad` 和 `onShow` 两个生命周期。

### 7. 关闭小窗页面

- openType: `dismissPip`

关闭小窗页面路由 `dismissPip` 表示关闭一个正处于小窗模式的页面。

## 附注

`switchTab` 事件的处理逻辑较为复杂，下面的表格用以展示在各种情况下进行 `switchTab` 时生命周期的触发情况，作为辅助说明。在这个表格中，我们假设：

- `tabA` , `tabB` 为 tabBar 页面
- `C` 是一个非 tabBar 页面，并且我们只会从 `tabA` 页面打开它
- `D` 是一个非 tabBar 页面，并且我们只会从 `tabB` 页面打开它

<table><thead><tr><th>当前页面</th> <th><code>switchTab</code> 目标页面</th> <th>触发的生命周期（按顺序）</th></tr></thead> <tbody><tr><td><code>tabA</code></td> <td><code>tabA</code></td> <td>Nothing happened</td></tr> <tr><td><code>tabA</code></td> <td><code>tabB</code></td> <td><code>tabA.onHide()</code>, <code>tabB.onLoad()</code>, <code>tabB.onShow()</code></td></tr> <tr><td><code>tabA</code></td> <td><code>tabB</code>（再次打开）</td> <td><code>tabA.onHide()</code>, <code>tabB.onShow()</code></td></tr> <tr><td><code>C</code></td> <td><code>tabA</code></td> <td><code>C.onUnload()</code>, <code>tabA.onShow()</code></td></tr> <tr><td><code>C</code></td> <td><code>tabB</code></td> <td><code>C.onUnload()</code>, <code>tabB.onLoad()</code>, <code>tabB.onShow()</code></td></tr> <tr><td><code>D</code></td> <td><code>tabB</code></td> <td><code>D.onUnload()</code>, <code>tabB.onShow()</code></td></tr> <tr><td><code>D</code>（从转发进入）</td> <td><code>tabA</code></td> <td><code>D.onUnload()</code>, <code>tabA.onLoad()</code>, <code>tabA.onShow()</code></td></tr> <tr><td><code>D</code>（从转发进入）</td> <td><code>tabB</code></td> <td><code>D.onUnload()</code>, <code>tabB.onLoad()</code>, <code>tabB.onShow()</code></td></tr></tbody></table>
