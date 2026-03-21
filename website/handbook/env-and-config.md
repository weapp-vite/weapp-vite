---
title: 环境变量与配置怎么分层
description: 从新用户视角解释构建期变量、运行期配置和小程序 JSON 配置的边界，帮助你避免开发环境正常、线上环境出问题。
keywords:
  - handbook
  - env
  - config
  - 环境变量
  - 配置分层
---

# 环境变量与配置怎么分层

很多项目不是“不会配”，而是“把不同阶段的配置混在一起了”。

小程序项目里至少有 3 类配置：

1. 构建期配置
2. 运行期配置
3. 小程序宿主配置

如果这三类混在一起，最容易出现的问题就是：

- 本地开发正常
- 预发环境正常
- 一到正式环境就开始白屏、跳错页、请求错域名

## 先用一句话区分三类配置

### 构建期配置

在 Node 环境里生效，决定打包结果。

例如：

- `.env`
- `.env.development`
- `.env.production`
- `vite.config.ts`

### 运行期配置

在小程序真正运行时生效，通常来自：

- 远端接口返回
- 本地缓存
- 登录态
- 灰度策略

### 宿主配置

由小程序框架和页面配置决定，例如：

- `app.json`
- `page.json`
- `definePageJson()`

## 一个推荐分层方式

你可以把项目里的配置组织成这样：

```txt
src/
├─ app.json
├─ config/
│  ├─ env.ts
│  ├─ runtime.ts
│  └─ featureFlags.ts
└─ services/
   └─ remoteConfig.ts
```

例如：

```ts
// src/config/env.ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
export const APP_ENV = import.meta.env.MODE
```

```ts
// src/config/runtime.ts
export interface RuntimeConfig {
  enableNewCouponFlow: boolean
  customerServiceUrl: string
}
```

```ts
// src/services/remoteConfig.ts
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  return request({
    url: '/api/runtime-config',
  })
}
```

这样做的好处是：

- 构建期变量和运行期变量天然分开
- 页面里不会到处散落环境判断
- 排查问题时知道该去哪里看

## 一个最小示例：按环境切换 API 域名

```env
# .env.development
VITE_API_BASE_URL=https://dev-api.example.com
```

```env
# .env.production
VITE_API_BASE_URL=https://api.example.com
```

```ts
// services/request.ts
const baseURL = import.meta.env.VITE_API_BASE_URL

export function request<T>(options: { url: string }) {
  return wx.request<T>({
    url: `${baseURL}${options.url}`,
  })
}
```

这个例子属于“构建期决定”的配置，因为域名在打包时就已经确定。

## 不要把运行时能力塞进构建期

这是新用户最常见的错误之一。

错误示例：

```ts
const token = wx.getStorageSync('token')
```

如果你把这种逻辑写进构建期执行的宏、配置函数或 Node 侧代码里，就会出问题，因为那时根本不在小程序运行环境中。

更稳的写法是：

```ts
export function getToken() {
  return wx.getStorageSync('token')
}
```

然后在运行时调用它。

## 页面配置和业务配置不要混

例如页面标题这种宿主配置：

```ts
definePageJson(() => ({
  navigationBarTitleText: '订单详情',
}))
```

就不要和业务环境变量混在一起判断页面路径或页面存在性。

不推荐这样做：

```ts
definePageJson(() => ({
  navigationBarTitleText: import.meta.env.PROD ? '线上标题' : '测试标题',
}))
```

除非你非常清楚这样做的维护成本。

## 最小配置检查清单

```txt
[ ] 敏感信息不提交到仓库
[ ] 构建期变量只做构建期判断
[ ] 运行期状态通过 service/store/cache 获取
[ ] 页面 JSON 配置只表达页面语义
[ ] 不用环境变量拼接不稳定的页面路径
```

## 新用户建议

一开始不必设计复杂的配置中心。
先把这三件事分开就够了：

- `.env*` 管构建变量
- `services/remoteConfig.ts` 管远端运行时配置
- `app.json / definePageJson()` 管宿主配置

然后继续看：

- [构建产物到底长什么样](/handbook/build-and-output)
- [先建立 SFC 心智模型](/handbook/sfc/)
