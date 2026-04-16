---
title: 多小程序平台前置准备设计
date: 2026-04-16
status: implemented
---

# 多小程序平台前置准备设计

## 目标

这次不直接实现“单次命令同时产出多个小程序平台”，而是先把后续实现必然依赖的基础契约固定下来，避免平台能力、目标集合和 `multiPlatform` 解析逻辑继续散落在 `build/watch/npm/config` 多处。

## 本次前置准备

### 1. 统一 `multiPlatform` 解析结果

新增独立的 `multiPlatform` 解析层，统一产出：

- `enabled`
- `projectConfigRoot`
- `targets`

后续模块直接消费 resolved 结果，不再重复自行判断 `typeof multiPlatform === 'object'`、默认目录、目标平台集合等细节。

### 2. 显式声明目标平台集合

为 `weapp.multiPlatform` 增加 `targets`，支持：

- `'all'`
- 平台数组

当前阶段它主要用于：

- 限定允许参与多平台开发/构建的目标集合
- 在配置阶段尽早拦截无效平台和空集合
- 为后续“顺序/并行平台编排”提供稳定输入

### 3. 收束内部调用点

将 `buildService`、`watch`、`npm relation` 等逻辑统一切到 `configService.multiPlatform`，避免未来平台矩阵扩展时需要回头逐个修修补补。

## 暂不覆盖

- 单次 CLI 同时编译多个小程序平台
- 多平台 IDE 调度
- 多平台产物汇总报告

这些能力将在后续直接基于本次补齐的 `targets` 与 resolved multi-platform 状态继续推进。
