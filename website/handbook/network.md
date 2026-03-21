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

页面真正关心的是：

- 当前列表数据
- 是否 loading
- 是否需要下拉刷新
- 出错后怎么展示

这些更适合放在 store 或 composable 里：

```ts
import { ref } from 'wevu'
import { getOrderList } from '../services/order'

export function useOrderListStore() {
  const list = ref<OrderListItem[]>([])
  const loading = ref(false)
  const errorMessage = ref('')

  async function fetchList() {
    loading.value = true
    errorMessage.value = ''

    try {
      list.value = await getOrderList()
    }
    catch (error) {
      errorMessage.value = '订单列表加载失败'
    }
    finally {
      loading.value = false
    }
  }

  return {
    list,
    loading,
    errorMessage,
    fetchList,
  }
}
```

## 页面里应该剩下什么

页面最好只做“编排”，而不是自己处理所有接口细节。

```vue
<script setup lang="ts">
import { onLoad } from 'wevu'
import { useOrderListStore } from '../../stores/order'

const { list, loading, fetchList } = useOrderListStore()

onLoad(fetchList)
</script>
```

这样页面职责就很明确：

- 负责什么时候触发加载
- 负责把状态渲染出来
- 不负责底层请求细节

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
