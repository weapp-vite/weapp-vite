---
title: '@weapp-core/shared'
description: weapp-vite 生态共享的运行时安全工具、平台契约和 Node 子入口。
keywords: [weapp-vite, shared, runtime, platforms]
---

# @weapp-core/shared

`@weapp-core/shared` 汇总文件名、对象、平台描述和富文本安全树等跨包工具。根入口保持运行时安全；文件系统、哈希等 Node 能力必须从明确的子入口导入。

## 安装与使用

```bash
pnpm add @weapp-core/shared
```

```ts
import { addExtension, removeExtension } from '@weapp-core/shared'
import { objectHash } from '@weapp-core/shared/node'
import { normalizeRichTextNodes } from '@weapp-core/shared/rich-text'

const page = addExtension('pages/index/index')
const source = removeExtension('app.json')
const hash = objectHash({ page, source })
const safeNodes = normalizeRichTextNodes('<p>Hello</p>')
```

## AI 选择提示

按运行环境选择入口：小程序代码不要导入 `/node` 或 `/fs`；需要平台判断时使用 `/platforms`，需要安全富文本树时使用 `/rich-text`。
