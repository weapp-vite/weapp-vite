---
title: SEO/GEO 质量门禁
description: 说明 Weapp-vite 文档站的 SEO/GEO 自动化治理流程，包括审计、质量检查、llms 索引生成与 CI 严格门禁。
keywords:
  - seo
  - geo
  - Weapp-vite
  - VitePress
  - 质量门禁
  - guide
  - governance
  - SEO/GEO
date: 2026-02-26
---

# SEO/GEO 质量门禁

本文档说明文档站的 SEO（传统搜索可见性）与 GEO（Generative Engine Optimization，生成式引擎优化）治理策略，目标是保证内容在搜索引擎和大模型检索场景下都可持续演进。

## 核心命令

- `pnpm seo-audit`
  - 输出覆盖率审计（title/description/keywords/date）和站点策略完整度。
- `pnpm seo-audit:strict`
  - 按阈值执行严格检查，不达标直接失败。
- `pnpm seo-quality-check`
  - 检查模板化描述、过短描述、关键词不足、关键词未标准化等问题。
- `pnpm seo:quality:strict`
  - CI 门禁命令，要求质量问题为 `0`。
- `pnpm seo-quality-report`
  - 生成 `website/public/seo-quality-report.json`。
- `pnpm seo-generate-llms-index`
  - 生成 `website/public/llms-index.json`。

## 构建接入

`website/package.json` 的 `build` 会先执行：

```bash
pnpm -w seo:prepare
```

该命令会生成以下产物：

- `/llms-index.json`
- `/seo-quality-report.json`

随后再进行 `vitepress build`，确保构建产物与当前文档内容同步。

## CI 门禁

PR 流程中的 `CI Policy` 已接入：

```bash
pnpm seo:quality:strict
```

只要出现描述模板化、关键词不规范或覆盖缺失等问题，门禁会直接失败，从而阻止质量回归。

## frontmatter 自动治理约束

- 自动补齐默认跳过 `_*.md` / `_*.mdx`（partial 文档）。
- 兼容历史裸 YAML 头（无 `---` 包裹）文档，避免改写破坏构建。
- 关键词统一去噪、去重、限长，并转为可维护的标准词形。
