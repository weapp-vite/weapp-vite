---
title: 原生能力调用（wx.）
description: 原生能力调用（wx.*），聚焦 handbook / native-apis 相关场景，覆盖 weapp-vite 与 wevu 的能力、配置和实践要点。
keywords:
  - api
  - handbook
  - native
  - apis
  - 原生能力调用（wx.）
  - 聚焦
  - /
  - native-apis
---

# 原生能力调用（wx.\*）

## 本章你会学到什么

- 如何把 `wx.*` 能力封装成“可测试、可复用”的 service
- 权限、隐私合规与降级策略的组织方式

## 推荐封装方式

- 每类能力一个模块：`services/storage.ts`、`services/location.ts`、`services/auth.ts`
- 所有调用统一做错误转换（把平台错误码转成业务可识别的错误）
- 做能力探测与降级：低基础库/不支持的 API 必须有 fallback

## 高风险点（务必提前设计）

- 登录与授权：流程很容易分叉，建议统一为状态机/流程编排
- 地理位置/相机等权限：拒绝后要有引导与设置页跳转
- 文件系统：缓存清理策略必须明确
