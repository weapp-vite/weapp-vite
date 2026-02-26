---
title: 构建、预览与上传
description: 构建、预览与上传，聚焦 handbook / publish 相关场景，覆盖 weapp-vite 与 wevu 的能力、配置和实践要点。
keywords:
  - handbook
  - publish
  - 构建
  - 预览与上传
  - 聚焦
  - /
  - 相关场景
  - 覆盖
---

# 构建、预览与上传

## 本章你会学到什么

- 从构建到开发者工具预览/上传的关键步骤
- 线上与本地一致性如何保证

## 标准流程（建议写进团队脚本）

1. `pnpm build`
2. 微信开发者工具打开产物目录（`miniprogramRoot` 指向 `dist`）
3. 真机预览（重点看：分包、图片路径、登录态、分享）
4. 上传

## 常见坑

- `project.config.json` 指向了源码目录而不是 `dist`
- CI 环境缺少必要的环境变量（导致宏注入的 json 变成默认值）

## 相关链接

- weapp-ide-cli（如你的流程涉及 open/preview/upload）：`packages/weapp-ide-cli`
