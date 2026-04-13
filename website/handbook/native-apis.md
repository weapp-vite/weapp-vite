---
title: 原生能力调用与封装
description: 解释 wx.* 能力在真实项目里应该如何按模块封装、做能力探测、处理授权和失败降级，避免业务页面直接耦合平台细节。
keywords:
  - handbook
  - native apis
  - wx
  - 原生能力
---

# 原生能力调用与封装

小程序业务一旦进入真实阶段，迟早会接触这些能力：

- 登录
- 存储
- 定位
- 图片选择与上传
- 分享
- 文件下载

这时最容易出现的问题是：页面里直接到处写 `wx.*`。

短期看很快，长期会带来这些后果：

- 页面逻辑和平台细节耦合
- 测试和 mock 困难
- 权限、失败、降级行为不统一

## 一个更稳的思路：按能力模块封装

你可以按平台能力来拆模块：

```txt
src/services/native/
├─ auth.ts
├─ storage.ts
├─ location.ts
├─ media.ts
└─ share.ts
```

例如封装本地存储：

```ts
// services/native/storage.ts
export function getToken() {
  return wx.getStorageSync('token')
}

export function setToken(token: string) {
  wx.setStorageSync('token', token)
}

export function clearToken() {
  wx.removeStorageSync('token')
}
```

## 一个真实点的例子：定位能力

直接在页面里这样写并不理想：

```ts
wx.getLocation({
  type: 'gcj02',
  success(res) {
    console.log(res)
  },
})
```

更推荐封成一个服务：

```ts
// services/native/location.ts
export async function getCurrentLocation() {
  return new Promise<WechatMiniprogram.GetLocationSuccessCallbackResult>((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      success: resolve,
      fail: reject,
    })
  })
}
```

页面只关心业务结果：

```ts
import { getCurrentLocation } from '../../services/native/location'

async function locateStore() {
  try {
    const location = await getCurrentLocation()
    console.log(location.latitude, location.longitude)
  }
  catch {
    wx.showToast({
      title: '定位失败',
      icon: 'none',
    })
  }
}
```

## 你应该统一处理的 3 件事

### 1. 能力探测

不是所有宿主、所有基础库、所有平台都支持同一组 API。

所以在高风险能力上，建议先做探测：

```ts
export function canUseChooseLocation() {
  return typeof wx.chooseLocation === 'function'
}
```

### 2. 授权失败

不要把“用户拒绝授权”的处理散落在每个页面里。

更稳的做法是统一处理：

- 弹提示
- 引导去设置
- 记录失败场景

### 3. 错误转换

页面最好看到的是“业务语义错误”，而不是平台底层错误细节。

例如：

```ts
export class LocationDeniedError extends Error {}
export class LocationUnavailableError extends Error {}
```

然后在 service 内部做转换。

## 登录能力尤其值得提前封装

登录不是一个 API，而是一条流程。

建议至少拆出：

- `login()`
- `logout()`
- `getToken()`
- `refreshToken()`
- `ensureLogin()`

这样后面做请求拦截、未登录跳转、token 失效刷新时，复杂度会低很多。

## 页面里到底该保留多少平台细节

推荐原则是：

- 页面可以知道“我要调用定位 / 选择图片 / 分享”
- 页面不要关心“平台底层参数细节、错误码细节、重试细节”

一句话：

> 页面描述业务意图，service 负责和平台 API 说话。

## 一份很实用的原生能力检查清单

```txt
[ ] 高风险能力有统一 service
[ ] 授权拒绝有统一提示与降级
[ ] 低兼容 API 先做能力探测
[ ] 错误码不会直接泄漏到页面层
[ ] 上传/下载/文件类能力有清理策略
```

接下来你可以继续看：

- [分包与包体策略](/handbook/subpackages)
- [调试与排错（按层定位）](/handbook/debugging)
