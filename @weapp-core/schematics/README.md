# @weapp-core/schematics

## 简介

`@weapp-core/schematics` 提供小程序文件的生成能力与 JSON Schema 定义，供 weapp-vite 与相关工具进行模板生成、类型提示与校验。

## 特性

- 生成 JS / WXML / WXSS / JSON 模板
- 支持不同类型（app/page/component）
- 导出 JSON Schema 定义供编辑器插件使用

## 安装

```bash
pnpm add @weapp-core/schematics
```

## 使用

```ts
import {
  generateJs,
  generateJson,
  generateWxml,
  generateWxss,
  JSON_SCHEMA_DEFINITIONS,
} from '@weapp-core/schematics'

const jsCode = generateJs('page')
const wxmlCode = generateWxml('pages/index/index')
const wxssCode = generateWxss()
const jsonCode = generateJson('component', 'json')
```

## 配置

`generateJson(type, ext)` 说明：

- `type`: `app` / `page` / `component`
- `ext`: `json` / `js` / `ts`

## 相关链接

- 仓库：https://github.com/weapp-vite/weapp-vite
