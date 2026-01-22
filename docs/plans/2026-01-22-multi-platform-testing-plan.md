---
title: 多平台适配测试方案（weapp-vite）
date: 2026-01-22
status: draft
---

# 多平台适配测试方案（weapp-vite）

## 背景与目标

本方案覆盖 weapp-vite 多平台适配改动（模板平台 profile、事件语法糖、wxs/sjs 转换、输出后缀映射），要求在 weapp/alipay/tt/swan/jd/xhs 六个平台上具备足量测试与 95%+ 覆盖率。测试分三层：单元验证语义、集成验证产物链路、E2E 验证真实构建与运行。

## 总体矩阵

- 平台范围：weapp/alipay/tt/swan/jd/xhs。
- 重点路径：模板编译平台化、事件映射、wxs/sjs 处理、模板/样式/JSON/脚本后缀输出。
- 覆盖目标：packages/weapp-vite 为主，相关 wevu 路径补充断言；整体行覆盖率 95%+。

## 单元测试

1. wxml 扫描与事件：参数化覆盖 `@tap`、`@tap.catch`、`@tap.capture`、`@tap.capture.catch`、`@tap.mut`，断言 weapp/tt/swan 为 bind/catch/capture 规则，alipay 为 onTap/catchTap/captureTap/captureCatchTap。
2. handleWxml：平台化 template import 改后缀（wxml/html -> axml/ttml/swan/jxml/xhsml），wxs/sjs 标签替换与 src 扩展名归一（含 `.wxs.ts/.sjs.ts`）。
3. Vue SFC 模板编译：同一模板在不同平台 profile 输出 if/for/key/事件绑定属性差异断言。
4. WXS/SJS 转换：normalizeWxsFilename 与 transformWxsCode 的 require() 结果跨平台后缀正确，路径前缀不丢失。

## 集成测试

- wxmlEmit：模拟最小 compilerContext + wxmlService，断言 `emitWxmlAssetsWithCache` 产物扩展名与 script-module 扩展名随平台变化。
- Vue bundle emit：对 `emitVueBundleAssets` 做最小结果输入，检查 template/style/json/scoped-slot 产物后缀与 classStyleWxs 的 sjs/wxs 输出。

## E2E 测试

1. templates/：平台矩阵下 build 产物扩展名检查（文件存在性 + 简要内容断言）。
2. apps/：选 2-3 个代表项目（如 wevu-vue-demo、wevu-runtime-demo、vite-native），对各平台进行构建并断言输出目录结构与后缀一致。
3. 真实运行：保留 weapp 的 miniprogram-automator；其它平台若缺少工具仅做产物验证。

## 风险与对策

- 平台工具不可用：E2E 降级为产物断言。
- 覆盖率不足：以参数化用例补齐边界路径；对新增逻辑集中补测。
- 产物差异误报：断言仅覆盖稳定差异点（后缀/关键属性），避免过度快照。
