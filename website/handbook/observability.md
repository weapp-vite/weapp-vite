---
title: 监控、埋点与线上可观测性
description: 从线上问题定位的角度解释小程序项目里最值得先建设的错误监控、请求监控和业务埋点体系。
keywords:
  - handbook
  - observability
  - 监控
  - 埋点
---

# 监控、埋点与线上可观测性

很多团队在文档和开发阶段都很认真，但一上线就会暴露另一个问题：

> 线上出错了，却不知道发生在哪个页面、哪个版本、哪个用户场景。

所以可观测性不是“高级能力”，而是项目从 demo 走向稳定交付的必修项。

## 新项目最值得先做的 3 件事

### 1. 错误上报

至少要知道：

- 哪个页面报错
- 当前版本号是什么
- 用户基础环境是什么
- 错误堆栈是什么

### 2. 请求上报

至少要知道：

- 哪个接口失败了
- 错误码是什么
- 耗时多少
- 是否重试过

### 3. 关键业务埋点

至少要知道：

- 用户有没有点击核心入口
- 核心流程在哪一步流失
- 页面关键转化是否发生

## 一个推荐的最小结构

```txt
src/
├─ app/
│  └─ monitor.ts
└─ services/
   ├─ track.ts
   └─ report.ts
```

例如埋点入口可以先统一成这样：

```ts
// services/track.ts
export function track(event: string, payload: Record<string, unknown> = {}) {
  console.log('[track]', event, payload)
}
```

页面里只表达业务动作：

```ts
track('order_submit_click', {
  from: 'order-confirm',
  goodsCount: 3,
})
```

## 页面不应该直接拼装所有上报字段

推荐把这些公共字段在统一层补齐：

- 版本号
- 页面路径
- 用户 ID
- 平台信息
- 时间戳

这样页面不需要每次都重复写：

```ts
const commonContext = {
  version,
  page,
  userId,
  scene,
}
```

## 一个错误上报的简单示例

```ts
export function reportError(
  error: unknown,
  extra: Record<string, unknown> = {},
) {
  const route = getCurrentPages().at(-1)?.route || ''

  console.error('[reportError]', {
    route,
    error,
    ...extra,
  })
}
```

在请求封装里也可以接入：

```ts
try {
  const data = await request({ url: '/api/order' })
  return data
}
catch (error) {
  reportError(error, { module: 'order' })
  throw error
}
```

## 埋点最容易做错的地方

### 1. 事件名没有规则

建议至少统一成：

```txt
页面_动作_结果
```

例如：

- `login_submit_success`
- `coupon_receive_click`
- `order_pay_fail`

### 2. 页面里到处散落上报

埋点越散，后期越难统一维护。

### 3. 只埋点击，不埋关键结果

例如你只埋了“点击支付按钮”，却没埋“支付成功 / 失败”，那分析价值会很有限。

## 一套很实用的最小上线清单

```txt
[ ] 页面级错误能上报
[ ] 请求失败能上报
[ ] 关键业务链路有埋点
[ ] 事件名有统一规范
[ ] 公共上下文字段统一补齐
```

接下来建议继续看：

- [性能与体验优化](/handbook/performance)
- [调试与排错（按层定位）](/handbook/debugging)
