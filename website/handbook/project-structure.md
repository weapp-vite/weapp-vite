---
title: 目录结构怎么放最顺手
description: 从新用户和中小型业务项目的视角，解释 Weapp-vite 项目里的页面、组件、服务、状态和静态资源应该怎么落位。
keywords:
  - handbook
  - project structure
  - 目录结构
  - Weapp-vite
---

# 目录结构怎么放最顺手

新项目一开始最容易出现两种极端：

- 什么都塞进 `pages/`，后面越写越乱
- 一上来就设计十几层目录，结果团队没人记得住

更稳的做法是：先用一个足够清晰、又不过度设计的结构跑起来。

## 一个推荐的起步结构

如果你现在准备做的是一个正常业务小程序，可以先从下面这个结构开始：

```txt
src/
├─ app.vue
├─ app.json
├─ pages/
│  ├─ home/
│  │  └─ index.vue
│  └─ order/
│     ├─ list.vue
│     └─ detail.vue
├─ components/
│  ├─ product-card/
│  │  └─ index.vue
│  └─ empty-state/
│     └─ index.vue
├─ stores/
│  ├─ user.ts
│  └─ cart.ts
├─ services/
│  ├─ request.ts
│  ├─ user.ts
│  └─ order.ts
├─ utils/
│  ├─ formatPrice.ts
│  └─ time.ts
└─ assets/
   ├─ images/
   └─ icons/
```

在真实项目根目录里，通常还会看到这些不属于 `src/`、但同样重要的文件：

```txt
.
├─ vite.config.ts
├─ project.config.json
├─ AGENTS.md
├─ .weapp-vite/
└─ dist/
```

它们分别负责：

- `vite.config.ts`：项目配置入口
- `project.config.json`：微信开发者工具工程配置
- `AGENTS.md`：给 AI 的项目级工作流约束
- `.weapp-vite/`：托管的支持文件与类型产物
- `dist/`：最终给开发者工具或 CI 使用的构建产物

它背后的分工很简单：

- `pages/`
  放页面入口，一个页面一个目录或一个主文件
- `components/`
  放会复用的业务组件或通用组件
- `stores/`
  放状态管理，不要把接口请求、页面渲染和状态都揉在一起
- `services/`
  放请求封装和领域 API
- `utils/`
  放纯工具函数
- `assets/`
  放跨页面复用的静态资源

## 页面目录里建议放什么

一个页面最常见的落位方式是：

```txt
pages/order-detail/
├─ index.vue
├─ components/
│  └─ goods-item.vue
└─ useOrderDetail.ts
```

页面局部的内容可以尽量贴近页面放，这样好处是：

- 打开页面目录就能看到完整上下文
- 页面下线时，局部组件和组合逻辑也能一起删掉
- 不会把全局 `components/` 变成“公共垃圾场”

比如：

```vue
<!-- pages/order-detail/index.vue -->
<script setup lang="ts">
import GoodsItem from './components/goods-item.vue'
import { useOrderDetail } from './useOrderDetail'

const { detail, loading } = useOrderDetail()
</script>
```

## 什么时候放到全局 `components/`

满足下面两个条件，再考虑提升到全局：

1. 确实被多个页面复用
2. 组件本身已经有稳定的输入输出边界

例如这些通常适合放全局：

- `empty-state`
- `price-text`
- `loading-view`
- `user-avatar`

而这种更适合留在页面目录：

- `order-status-card`
- `coupon-dialog`
- `refund-reason-panel`

## `services` 和 `stores` 不要混

一个非常常见的问题是：把请求、缓存、页面 loading、错误提示全塞进页面里。

更推荐的分法是：

```ts
// services/order.ts
export async function getOrderDetail(id: string) {
  return request<OrderDetail>({
    url: `/api/orders/${id}`,
  })
}
```

```ts
// stores/order.ts
import { ref } from 'wevu'
import { getOrderDetail } from '../services/order'

export function useOrderStore() {
  const detail = ref<OrderDetail | null>(null)
  const loading = ref(false)

  async function fetchDetail(id: string) {
    loading.value = true
    try {
      detail.value = await getOrderDetail(id)
    }
    finally {
      loading.value = false
    }
  }

  return {
    detail,
    loading,
    fetchDetail,
  }
}
```

一句话理解：

- `services` 负责和服务端对话
- `stores` 负责把状态组织给页面消费

## 文件命名建议

从长期维护角度，建议一开始就统一：

- 页面目录：语义化、稳定，尽量不要频繁改路径
- 组件目录：`kebab-case`
- 工具函数文件：`camelCase`
- store 名称：按业务域命名，不要做成“超级 store”

例如：

```txt
components/product-card/index.vue
stores/cart.ts
services/order.ts
utils/formatPrice.ts
```

## 新用户最容易踩的目录坑

### 1. 所有内容都放全局

结果是：

- 小组件越来越多
- 页面上下文越来越难找
- 复用和“看起来像复用”混在一起

### 2. 所有内容都放页面目录

结果是：

- 公共组件没有真正抽象出来
- 同一逻辑在不同页面复制粘贴

### 3. 过早拆成特别复杂的领域层

如果你的项目还没超过几个核心业务页面，就不必一上来设计太复杂的模块边界。

### 4. 忽略项目根目录的 AI / 工具文件

当前版本里，下面几个文件或目录不应该被当成“无关生成物”：

- `AGENTS.md`
- `.weapp-vite/`
- `dist/`

建议理解为：

- `AGENTS.md` 决定 AI 进入项目后先读什么、优先用什么命令
- `.weapp-vite/` 决定编辑器类型提示、自动路由类型、自动导入组件类型是否稳定
- `dist/` 决定开发者工具最终看到的到底是不是你以为的输出

如果类型提示异常、AI 行为跑偏、下游验证与源码不一致，先检查这三者是否同步。

## 什么时候应该运行 `weapp-vite prepare`

优先在这些场景执行：

- 新 clone 下来的项目第一次打开
- 升级了 `weapp-vite`
- `.weapp-vite` 缺失
- Volar / TypeScript 提示异常
- 想在 `dev/build` 之前先把支持文件生成好

```bash
weapp-vite prepare
```

如果你是让 AI 进入项目处理问题，也建议它先读：

1. 根目录 `AGENTS.md`
2. `node_modules/weapp-vite/dist/docs/index.md`
3. `vite.config.ts`

## 一句话建议

先让结构服务于“能快速定位代码”，而不是服务于“看起来很高级”。

你现在可以继续看：

- [环境变量与配置怎么分层](/handbook/env-and-config)
- [构建产物到底长什么样](/handbook/build-and-output)
- [先建立 SFC 心智模型](/handbook/sfc/)
