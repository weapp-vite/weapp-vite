---
title: 网络请求与数据层
description: 从真实业务页面出发，解释请求封装、领域 service、store 和页面编排之间的边界，让新用户知道请求代码应该放在哪里。
keywords:
  - handbook
  - network
  - request
  - 数据层
---

# 网络请求与数据层

如果你把请求直接写在页面里，项目通常能跑一阵子；
但一旦业务变复杂，代码会很快出现这些问题：

- 页面里全是接口细节
- 登录态刷新逻辑到处复制
- loading、错误提示、缓存状态混在一起

更稳的思路是把网络层拆成 3 层：

1. `request` 基础封装
2. `services` 领域接口
3. `stores` 或页面组合逻辑

## 推荐的最小结构

```txt
src/
├─ services/
│  ├─ request.ts
│  ├─ user.ts
│  └─ order.ts
└─ stores/
   └─ order.ts
```

## 第 1 层：基础请求封装

基础请求层只做通用事情：

- baseURL
- 超时
- header
- 错误转换
- 登录态注入

例如：

```ts
// services/request.ts
export async function request<T>(options: WechatMiniprogram.RequestOption) {
  const token = wx.getStorageSync('token')

  return new Promise<T>((resolve, reject) => {
    wx.request({
      timeout: 10000,
      ...options,
      header: {
        Authorization: token ? `Bearer ${token}` : '',
        ...options.header,
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T)
          return
        }
        reject(res)
      },
      fail(err) {
        reject(err)
      },
    })
  })
}
```

## 第 2 层：按业务域拆 service

service 不负责页面 loading，也不负责页面跳转。
它只负责表达“我要请求哪个业务接口”。

```ts
// services/order.ts
import { request } from './request'

export function getOrderList() {
  return request<OrderListItem[]>({
    url: '/api/orders',
    method: 'GET',
  })
}

export function getOrderDetail(id: string) {
  return request<OrderDetail>({
    url: `/api/orders/${id}`,
    method: 'GET',
  })
}
```

## 第 3 层：store 或页面组合逻辑

页面真正关心的是首次加载、刷新、成功值和错误状态。这些状态不需要在每个业务里重复手写；静态 WXML 页面可以直接使用 `useAsyncDerivation()` 的显式状态机：

```ts
// stores/order.ts
import { useAsyncDerivation } from 'wevu'
import { getOrderList } from '../services/order'

export function useOrderListStore() {
  return useAsyncDerivation<OrderListItem[]>(() => getOrderList())
}
```

## 页面里应该剩下什么

页面只负责把状态编排成静态模板，并把下拉刷新连接到同一个 `refresh()`：

```vue
<script setup lang="ts">
import { useAsyncPullDownRefresh } from 'wevu'
import { useOrderListStore } from '../../stores/order'

const orders = useOrderListStore()
useAsyncPullDownRefresh(orders.refresh)
</script>

<template>
  <view v-if="orders.status === 'initial-pending'">订单加载中</view>
  <view v-else-if="orders.status === 'error' && !orders.value">
    订单列表加载失败
  </view>
  <block v-else>
    <view v-if="orders.status === 'refreshing'">正在刷新</view>
    <view v-if="orders.status === 'error'">刷新失败，继续显示上次结果</view>
    <view v-for="order in orders.value" :key="order.id">
      {{ order.title }}
    </view>
  </block>
</template>
```

`immediate` 默认是 `true`，所以页面不需要再用 `onLoad()` 启动首个请求。`initial-pending` 没有历史值；`refreshing` 会保留上次成功值；刷新失败进入 `error` 但仍保留该值。加载错误通过 `orders.status/orders.error` 表达，`orders.refresh()` 本身会正常完成，适合交给下拉刷新流程统一收尾。

模板仍由编译器生成静态 WXML，没有运行时 loading 组件或异步渲染边界。加载函数也不会像同步 `computed()` 一样自动追踪依赖；筛选条件变化时应显式调用 `orders.refresh()`。如果底层请求支持取消，可把加载函数收到的 `signal` 继续传给 service。

## 登录态刷新要不要一开始就做

不一定要第一天就做完整，但架构上最好留出位置。

最起码你要提前想清楚：

- 哪个错误码表示 token 失效
- 刷新失败后要跳去哪里
- 并发请求期间如何避免重复刷新

如果业务已经有登录态，那么建议尽早统一请求入口。不要让不同页面各自带 token。

## 上传和下载属于同一层吗

属于“网络与数据通道”的一部分，但通常会单独封装。

例如：

```ts
export function uploadAvatar(filePath: string) {
  return wx.uploadFile({
    url: '/api/upload/avatar',
    filePath,
    name: 'file',
  })
}
```

这类接口尤其要提前考虑：

- 失败重试
- 进度反馈
- 临时文件清理

## 一个足够稳的最小原则

如果你现在还不确定项目规模，可以先只做到这三条：

- 页面不直接写 `wx.request`
- 所有接口请求统一走 `services/request.ts`
- 页面数据状态通过 store 或 composable 管理

然后再继续看：

- [原生能力调用与封装](/handbook/native-apis)
- [分包与包体策略](/handbook/subpackages)
