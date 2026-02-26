---
title: 构建与输出：你应该关心什么
description: 构建与输出：你应该关心什么，聚焦 handbook / build-and-output 相关场景，覆盖 weapp-vite 与
  wevu 的能力、配置和实践要点。
keywords:
  - handbook
  - build
  - output
  - 构建与输出：你应该关心什么
  - 聚焦
  - /
  - build-and-output
  - 相关场景
---

# 构建与输出：你应该关心什么

## 本章你会学到什么

- dev/build 的差异与产物结构
- 出现“路径不对/资源不对”时怎么定位

## 你要关心的 4 件事

1. **产物根目录**：微信开发者工具的 `miniprogramRoot` 应指向 weapp-vite 输出目录（通常是 `dist`）。
2. **页面/组件是否完整生成**：页面缺失通常来自路由配置/扫描规则/文件命名问题。
3. **资源路径是否被重写**：图片/字体/子包资源常见坑是“开发 ok，构建后路径错”。
4. **npm 策略**：自动构建 npm 与内联策略影响包体与兼容性。

## 相关链接（细节以现有文档为准）

- 构建输出：`/config/build-and-output`
- npm 策略：`/guide/npm`
- 分包：`/config/subpackages`、`/guide/subpackage`
- 静态资源优化：`/guide/image-optimize`
