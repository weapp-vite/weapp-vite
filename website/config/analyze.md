---
title: Analyze 报告配置
description: 说明 weapp.analyze 的包体预算、历史快照，以及 wv analyze 的 Markdown、PR 摘要和预算检查工作流。
keywords:
  - 配置
  - config
  - analyze
  - budget
  - history
  - report
---

# Analyze 报告配置 {#analyze-config}

`weapp.analyze` 用来给 `wv analyze` 补充项目级预算和历史快照配置。它不会改变构建产物，只影响分析报告、预算检查和增量归因。

[[toc]]

## `weapp.analyze.budgets` {#weapp-analyze-budgets}

- **类型**：`object`
- **默认值**：总包 `20 MB`，主包 / 普通分包 / 独立分包 `2 MB`，预警比例 `0.85`
- **适用场景**：在本地或 CI 中对小程序产物体积做预算检查。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    analyze: {
      budgets: {
        totalBytes: 20 * 1024 * 1024,
        mainBytes: 2 * 1024 * 1024,
        subPackageBytes: 2 * 1024 * 1024,
        independentBytes: 2 * 1024 * 1024,
        warningRatio: 0.85,
      },
    },
  },
})
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `totalBytes` | 全部小程序产物合计预算 |
| `mainBytes` | 主包预算 |
| `subPackageBytes` | 普通分包预算 |
| `independentBytes` | 独立分包预算 |
| `warningRatio` | 预警比例，达到该比例但未超限时标记为接近预算 |

运行预算检查：

```bash
wv analyze --budget-check
```

当任一预算超限时，命令会设置非 0 退出码，适合放进 CI。

## `weapp.analyze.history` {#weapp-analyze-history}

- **类型**：`boolean | object`
- **默认值**：开启，目录 `.weapp-vite/analyze-history`，保留 20 份快照
- **适用场景**：让 Markdown / PR 报告自动对比上一次分析结果，输出体积增量归因。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    analyze: {
      history: {
        enabled: true,
        dir: '.weapp-vite/analyze-history',
        limit: 20,
      },
    },
  },
})
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `enabled` | 是否写入历史快照 |
| `dir` | 快照目录，相对路径基于项目根目录解析 |
| `limit` | 最大保留快照数量，旧快照会自动清理 |

如果不希望本地写入历史快照，可以关闭：

```ts
export default defineConfig({
  weapp: {
    analyze: {
      history: false,
    },
  },
})
```

## 报告输出工作流 {#report-workflow}

`wv analyze` 支持三类常用输出：

```bash
# JSON，适合脚本消费
wv analyze --json --output reports/analyze.json

# 完整 Markdown 报告
wv analyze --markdown --output reports/analyze.md

# PR 摘要，适合写入 CI 评论
wv analyze --report pr --output reports/analyze-pr.md
```

Markdown 和 PR 报告会结合预算、重复模块、Top 增量和历史快照生成建议动作。第一次运行没有历史快照时，增量列会显示为无变化；从第二次开始会基于上一份快照对比。

## HMR profile 分析 {#hmr-profile}

如果开启了 [开发态 HMR 配置](./hmr.md) 中的 `weapp.hmr.profileJson`，可以直接聚合 JSONL profile：

```bash
wv analyze --hmr-profile
```

也可以显式指定文件：

```bash
wv analyze --hmr-profile .tmp/weapp-vite-hmr-profile.jsonl --json
```

该模式会输出样本数量、阶段平均耗时、最大耗时、事件分布、dirty / pending 原因和最慢样本，适合定位 HMR 变慢的阶段。

## Web 平台边界 {#web-platform}

```bash
wv analyze --platform h5 --json
```

Web 模式当前只做静态配置分析，覆盖 `weapp.web` 是否启用、`root` / `srcDir` / `outDir` 和 `runtime.executionMode`。它不扫描 Web 产物体积，也不提供分包映射和 dashboard。

## 关联阅读

- [CLI：analyze](../guide/cli.md#_3-analyze)
- [分包指南：分析产物布局](../guide/subpackage.md#分析产物布局)
- [开发态 HMR 配置](./hmr.md)
