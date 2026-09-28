---
title: 底层编译插件协议
description: 介绍 weapp.compilerPlugins 与 WeappCompilerPlugin 协议，帮助 UnoCSS 和其他编译器接入 weapp-vite 的 CSS、WXML、JavaScript 与 HMR 链路。
keywords:
  - compiler plugin
  - compilerPlugins
  - WeappCompilerPlugin
  - CSS 编译
  - WXML 编译
  - HMR
  - UnoCSS
  - weapp-vite
---

# 底层编译插件协议

`weapp.compilerPlugins` 是 `weapp-vite` 提供的底层编译扩展入口。第三方包可以通过公开的 `WeappCompilerPlugin` 协议声明源码所有权，并参与 CSS、WXML、JavaScript、bundle 和 HMR 生命周期。

```ts
import type { WeappCompilerPlugin } from 'weapp-vite/config'
import { defineConfig } from 'weapp-vite/config'

const compilerPlugin: WeappCompilerPlugin = {
  name: 'example-compiler',
  capabilities: { style: true, template: true, script: true, hmr: true },
  create() {
    return {
      claimSource: ({ id }) => id.endsWith('.css'),
      transformSource: ({ code }) => ({ code }),
      transformCss: ({ code }) => ({ code }),
    }
  },
}

export default defineConfig({
  weapp: {
    compilerPlugins: [compilerPlugin],
  },
})
```

每个源码入口首期只能由一个 provider 接管。provider 可以通过 `claimSource` 返回入口标识和依赖，再在 controller 中实现产物转换、bundle 最终化、监听、HMR 和 `dispose`。provider 的内部状态由 provider 自己维护，host 只处理稳定的转换结果、source map、依赖、入口标识和失效集合。

`weapp.tailwindcss` 仍然是内置 Tailwind adapter 的兼容门面。UnoCSS 等实现可以作为独立包消费同一协议；首期不内置 UnoCSS adapter。


## 状态保持 HMR 批次

参与内容转换的 provider 可以实现 controller 的可选 `prepareHmr(request)`。输入包含源码版本 `revision`、本次变更的 `changedFiles`，以及固定的 `sources: ReadonlyMap<string, string | null>`；`null` 表示该版本中已删除的来源。准备阶段应使用这份输入视图，不能改读后续保存的文件或可变的最新快照。

返回值可以包含 `assets`、`dependencies`、`invalidated`、`transformJavaScript`、`transformTemplate` 和 `dispose`。每个资产使用最终相对输出路径 `fileName` 和文本 `code`；所有 Patch 转换必须共用本次准备持有的编译状态。开启 sourcemap 时，修改代码的转换必须返回相应映射。

宿主按批次提交资产、发布补丁并等待客户端执行回报，随后才通知 DevEngine。provider 不写构建输出，也不调用 `notifyPayloadDelivered`。生成或写入失败不会发布该批次补丁；后续请求可重试，无法连续交付时完整重同步。批次确认、取消或会话关闭后，宿主释放准备结果。

未实现该接口的内容 provider 继续支持普通构建；状态保持模式下的相关更新采用完整构建回退。该接口不改变 `weapp.tailwindcss` 配置入口。

当前内置 adapter 对直接受管样式根提供增量准备；尚不能固定产物归属的导入式样式使用完整重同步。依赖在准备期间再次变化、缺少可提交 owner 等情况也不会交付旧补丁。
