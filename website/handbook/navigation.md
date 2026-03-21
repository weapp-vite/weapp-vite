---
title: 页面跳转与路由参数
description: 用真实业务页面常见场景解释小程序导航 API、参数传递和页面栈管理，帮助新用户少走路由坑。
keywords:
  - handbook
  - navigation
  - 页面跳转
  - 路由参数
---

# 页面跳转与路由参数

小程序里的导航，看上去像一组 API，实际背后有 3 件事要同时考虑：

- 跳转到哪里
- 参数怎么带过去
- 页面栈会不会因此失控

## 先记住 5 个最常用 API

### `wx.navigateTo`

打开一个新的非 tab 页面。

```ts
wx.navigateTo({
  url: '/pages/order-detail/index?id=1001',
})
```

### `wx.redirectTo`

替换当前页，适合“我不希望用户再回到上一页”的场景。

```ts
wx.redirectTo({
  url: '/pages/login/index',
})
```

### `wx.switchTab`

切到 tabBar 页面。

```ts
wx.switchTab({
  url: '/pages/home/index',
})
```

### `wx.reLaunch`

清空当前页面栈，重新进入指定页。

```ts
wx.reLaunch({
  url: '/pages/home/index',
})
```

### `wx.navigateBack`

返回上一页或上几页。

```ts
wx.navigateBack({
  delta: 1,
})
```

## 一个最常见的业务场景

例如从订单列表进入订单详情：

```ts
function openOrderDetail(id: string) {
  wx.navigateTo({
    url: `/pages/order-detail/index?id=${encodeURIComponent(id)}`,
  })
}
```

详情页里读取参数：

```ts
import { onLoad } from 'wevu'

onLoad((query) => {
  const id = query.id
  console.log('current order id:', id)
})
```

这就是新项目里最常见、也最值得先掌握的路线。

## 参数怎么传最稳

### 简单参数：用 query

适合：

- `id`
- `tab`
- `source`

例如：

```ts
wx.navigateTo({
  url: '/pages/goods/index?id=sku-1&source=home',
})
```

### 大对象：不要直接塞 URL

不推荐这样：

```ts
wx.navigateTo({
  url: `/pages/confirm/index?payload=${encodeURIComponent(JSON.stringify(data))}`,
})
```

更稳的做法通常是：

- 只传主键或关键标识
- 页面二次拉取详情
- 或暂存到 store/cache 再在目标页读取

## 页面栈什么时候会出问题

### 场景 1：登录回跳

比如用户在下单前未登录：

```ts
if (!hasLogin()) {
  wx.navigateTo({
    url: '/pages/login/index?redirect=/pages/checkout/index',
  })
}
```

登录成功后，你通常要根据业务选择：

- 回上一页：`navigateBack`
- 替换为目标页：`redirectTo`
- 重建首页链路：`reLaunch`

### 场景 2：tab 页面跳转

tab 页不能用 `navigateTo` 打开。
这类问题是新用户最容易踩的坑之一。

错误心智：

```ts
wx.navigateTo({
  url: '/pages/home/index',
})
```

正确心智：

```ts
wx.switchTab({
  url: '/pages/home/index',
})
```

## 推荐封装一个轻量导航层

当项目页面多起来后，建议封装一层简单导航函数，不要让页面里散落大量字符串路径。

```ts
export function toOrderDetail(id: string) {
  return wx.navigateTo({
    url: `/pages/order-detail/index?id=${encodeURIComponent(id)}`,
  })
}

export function toHomeTab() {
  return wx.switchTab({
    url: '/pages/home/index',
  })
}
```

这样做的好处是：

- 页面路径统一管理
- 重构时更安全
- query 规则更统一

## 一份很实用的导航检查清单

```txt
[ ] tab 页面只用 switchTab
[ ] 详情页只传必要参数
[ ] 登录拦截后的回跳策略明确
[ ] 页面栈深度不会无限增长
[ ] 页面路径使用统一封装或常量
```

接下来最适合继续看的，是：

- [网络请求与数据层](/handbook/network)
- [原生能力调用与封装](/handbook/native-apis)
