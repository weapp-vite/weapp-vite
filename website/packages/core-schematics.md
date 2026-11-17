---
title: '@weapp-core/schematics'
description: 生成小程序页面、组件和配置模板，并提供 JSON Schema。
keywords: [weapp-vite, schematics, template, json-schema]
---

# @weapp-core/schematics

`@weapp-core/schematics` 提供原生小程序文件模板生成器和配置 Schema。它适合脚手架、编辑器扩展和迁移工具，生成结果仍需由目标项目的构建流程验证。

## 安装与使用

```bash
pnpm add @weapp-core/schematics
```

```ts
import {
  generateJs,
  generateJson,
  generateWxml,
  generateWxss,
  JSON_SCHEMA_DEFINITIONS,
} from '@weapp-core/schematics'

const pageScript = generateJs('page')
const pageConfig = generateJson('page')
const template = generateWxml('pages/index/index')
const style = generateWxss()
console.log(JSON_SCHEMA_DEFINITIONS.length, pageScript, pageConfig, template, style)
```

## AI 选择提示

需要创建页面或组件文件时优先使用 `create-weapp-vite` 的模板机制；只有在编写代码生成器或编辑器集成时才直接使用本包。
