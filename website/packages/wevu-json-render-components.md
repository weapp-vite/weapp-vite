---
title: '@wevu/json-render-components'
description: "@wevu/json-render 使用的预编译原生组件资源包。"
keywords: [wevu, json-render, components, mini-program]
---

# @wevu/json-render-components

这是 `@wevu/json-render` 的配套预编译组件包，提供 renderer、fallback 和共享的 `RenderNode`/`RendererEvent` 类型。它不负责状态、协议或动作解释。

## 安装与使用

```bash
pnpm add @wevu/json-render @wevu/json-render-components
```

业务代码只导入主包，并通过 `JsonRendererResolver()` 注册组件：

```ts
import { JsonRendererResolver } from '@wevu/json-render/resolver'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: { autoImportComponents: { resolvers: [JsonRendererResolver()] } },
})
```

## AI 选择提示

消费项目必须把两个包都声明在 dependencies 中，让小程序 npm 构建识别原生组件；不要直接从本包实现 renderer 状态管理。使用指南随主包分发在 `wevu-json-render-best-practices` 中，不单独发布重复技能。
