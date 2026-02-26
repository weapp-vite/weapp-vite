---
title: "@weapp-vite/volar"
description: "@weapp-vite/volar 为 Weapp-vite 项目提供 Volar 语言服务能力，重点增强 配置块的补全与校验。"
keywords:
  - Weapp-vite
  - packages
  - volar
  - "@weapp-vite/volar"
  - 为
  - 项目提供
  - 语言服务能力
  - 重点增强
---

# @weapp-vite/volar

`@weapp-vite/volar` 为 Weapp-vite 项目提供 Volar 语言服务能力，重点增强 `<json>` 配置块的补全与校验。

## 何时使用

- 你在 `.vue` 文件里使用 `<json>` 自定义块
- 你希望拿到配置字段的类型提示和错误检查
- 你在 VSCode + Volar 环境下做小程序配置开发

## 安装说明

通常不需要单独安装。使用 `weapp-vite` 时会自动带上该能力。

```bash
pnpm add -D @weapp-vite/volar
```

## 主要能力

- `<json>` 块配置提示与校验
- JSON Schema 语义支持
- 依据路径自动推断 `App/Page/Component` 配置类型
- 支持 `json/jsonc/json5` 与 js/ts 配置表达

## 推荐阅读

- [JSON 配置智能提示](/guide/json-intelli-sense)
- [使用 TS/JS 生成 JSON](/guide/json-enhance)
