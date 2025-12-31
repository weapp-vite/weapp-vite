---
title: 调试与排错（体系化）
---

# 调试与排错（体系化）

## 本章你会学到什么

- 遇到问题时的“最短定位路径”
- weapp-vite / SFC / wevu 三者的排错分层

## 第 0 步：先把现象分类

- 白屏（页面没出来）
- 页面出来但数据不更新
- 样式丢失/错乱
- 组件不渲染/事件不触发
- 构建后才出问题（dev 正常）

## 第 1 层：小程序侧排错

- 控制台错误（尤其是组件路径、json 配置错误、基础库 API 不存在）
- Network 面板（请求失败、域名白名单、超时）
- 存储（登录态、缓存污染）

## 第 2 层：SFC 编译侧排错（wuve）

- `usingComponents` 是否声明（详见 `/handbook/sfc/components`）
- `v-model` 是否写成“不可赋值表达式”（详见 `/handbook/sfc/events-and-v-model`）
- `<json>` 与宏的合并是否符合预期（详见 `/handbook/sfc/json`）

## 第 3 层：wevu 运行时排错

- hooks 是否在 `setup()` 同步阶段注册（详见 `/wevu/runtime`）
- 是否从 `wevu` 导入响应式 API（而不是 `vue`）

## 最小复现建议

遇到复杂问题时，先把问题缩到一个页面/一个组件，再把“业务依赖”剥离（只留模板 + 少量 state）。
