---
title: 多小程序平台兼容设计（weapp-vite + wevu）
date: 2026-01-22
status: draft
---

# 多小程序平台兼容设计（weapp-vite + wevu）

## 背景与目标

目标是在保持**源码统一使用 wxml/html** 的前提下，让 weapp-vite 输出适配 **支付宝（alipay）/字节（tt）/百度（swan）** 三个平台的产物（axml/ttml/swan 及对应样式/脚本后缀），并尽量复用 wevu 的运行时能力。

### 目标

- 源码模板统一写 wxml/html，SFC `<template>` 统一编译。
- 编译期完成平台差异转换，运行时保持尽量一致。
- 输出文件扩展名与平台匹配（axml/acss/sjs, ttml/ttss, swan/css/sjs）。
- CLI 与配置支持 `--platform` 选择平台。

### 非目标

- 不支持源码写平台专用模板语法（如 `a:if`/`s-if`/`tt:if`）。
- 不在本阶段覆盖 QQ/快手/京东/小红书/涂鸦（仅保留可扩展接口）。

## 现状

- 已有 `platform` 与 `outputExtensions` 适配层（`weapp/alipay/tt/swan`）。
- SFC 模板编译走 `compileVueTemplateToWxml`，平台能力由 `MiniProgramPlatform` 注入。
- 产物发出阶段仍存在 `.wxml/.wxss/.wxs` 的硬编码。
- 原生模板扫描与 WXML 增强（事件语法糖/依赖分析）仅针对 WXML 命名与规则。

## 设计方案（方案 1：编译期平台适配）

### 1) 平台模板 Profile

新增 `MiniProgramTemplateProfile`（或扩展现有 `MiniProgramPlatform`）：

- 条件/循环/键值属性：`ifAttr/elifAttr/elseAttr/forAttrs/keyAttr/keyThisValue`
- 事件绑定：`mapEventName` + `eventBindingAttr`
- 模板模块标签：`scriptModuleTag`（weapp: wxs, alipay/swan: sjs, tt: wxs）

SFC 编译与 WXML 增强均通过 `configService.platform` 获取 profile。

### 2) 产物输出后缀

统一使用 `configService.outputExtensions` 生成：

- Template 输出：`.wxml` -> `.axml/.ttml/.swan`
- Style 输出：`.wxss` -> `.acss/.ttss/.css`
- Script module 输出：`.wxs` -> `.sjs`（支付宝/百度）
- JSON/JS 保持 `.json/.js`

涉及点：

- `emitSfcTemplateIfMissing`、`emitSfcStyleIfMissing`、`emitSfcJsonAsset`、`emitScopedSlotAssets`
- fallback 产物与 scoped-slot 产物输出后缀
- WXS 处理链路统一为 `script-module` 概念，按平台重写文件后缀与模板标签

### 3) WXML 增强与扫描

将 `scanWxml` 抽象为 `scanTemplate`：

- 事件语法糖 `@tap` 转换由平台决定（`bind` vs `on`）
- 条件编译注释 `#ifdef` 平台值需要标准化（如 `weapp/alipay/tt/swan`）
- 依赖标签（import/include）按统一语法处理

### 4) 运行时与 API

wevu 运行时尽量保持一致，编译期解决差异：

- `ctx.emit` 保持小程序 `triggerEvent` 语义（单 detail）
- 选择器查询（`createSelectorQuery`）为多平台做兜底探测

## 平台差异清单（首批覆盖）

### 支付宝（alipay）

- 模板：`a:if/a:elif/a:else/a:for/a:key`
- 事件：`onTap` 语义（编译为 `on` 前缀）
- 模块脚本：`<sjs>` + `.sjs`
- 样式：`.acss`

### 字节（tt）

- 模板：`tt:if/tt:elif/tt:else/tt:for/tt:key`
- 事件：保持 `bind`
- 模块脚本：`<wxs>`（若平台不支持则降级）
- 样式：`.ttss`

### 百度（swan）

- 模板：`s-if/s-elif/s-else/s-for/s-key`
- 事件：`bind`
- 模块脚本：`<sjs>` + `.sjs`
- 样式：`.css`

> 注：具体语法以官方文档为准，设计中预留 profile 层可调整。

## 实施步骤（里程碑）

1. **平台 Profile 基建**：新增 profile 定义与解析入口，SFC 编译读取平台配置。
2. **产物后缀全面切换**：SFC 输出、scoped-slot 输出、fallback 输出统一走 `outputExtensions`。
3. **模板扫描/增强平台化**：事件语法糖/条件编译/依赖扫描按平台配置执行。
4. **运行时兜底**：selector query 与事件字段差异探测。
5. **文档与示例**：新增三平台构建示例与已知限制。

## 测试策略

- 单测：模板编译快照（同一输入输出 weapp/alipay/tt/swan 差异）。
- 集成：构建产物扩展名与目录结构断言。
- 回归：现有 weapp 测试必须全部通过。
- 示例：每个平台一个最小 app + page + component。

## 风险与对策

- 平台语法差异边界不全：用 profile 可快速修正，不影响核心编译流程。
- 运行时差异无法统一：优先编译期消解，必要时增加运行时 feature flag。
- 文档与用户预期偏差：提供明确的“统一写法”与“已支持平台”说明。
