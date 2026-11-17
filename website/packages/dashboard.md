---
title: '@weapp-vite/dashboard'
description: 查看 weapp-vite analyze 报告的可选工作台。
keywords: [weapp-vite, analyze, dashboard, performance]
---

# @weapp-vite/dashboard

`@weapp-vite/dashboard` 是 `wv analyze` 的可选可视化界面，用于查看构建依赖图、体积地图和性能诊断。它不参与小程序构建，也不会替代 `wv analyze` 生成报告。

## 安装

```bash
pnpm add -D @weapp-vite/dashboard
```

## 使用方式

```bash
wv analyze --report pr
wv analyze --markdown
```

安装后，`weapp-vite analyze`、`weapp-vite build --ui` 和 `weapp-vite dev --ui` 会自动发现本包的静态资源。CI 中建议保存 Markdown/JSON 报告作为证据，dashboard 只作为浏览入口。

## AI 选择提示

需要机器可读结论时优先 `wv analyze --report pr` 或 `--budget-check`；只有用户要求交互式图表时才安装本包。
