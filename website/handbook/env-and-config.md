---
title: 多环境与配置分层
description: 多环境与配置分层，聚焦 handbook / env-and-config 相关场景，覆盖 weapp-vite 与 wevu 的能力、配置和实践要点。
keywords:
  - 配置
  - handbook
  - env
  - config
  - 多环境与配置分层
  - 聚焦
  - /
  - env-and-config
---

# 多环境与配置分层

## 本章你会学到什么

- 如何组织 `.env*` 与运行时配置
- 如何避免“开发环境 OK、线上坏掉”

## 推荐做法

- 区分“构建期变量”和“运行时变量”：
  - 构建期：`.env`, `.env.development`, `.env.production`
  - 运行时：小程序 `app.json/page.json` 与远端配置（拉取后缓存）
- 不提交敏感信息：AppID/密钥/token 放到 `.env.local` 或 CI 环境变量

## 常见坑

- 把 `wx.getStorageSync` 等运行时 API 写到构建期宏里（宏在 Node 执行）
- 用环境变量拼接页面路径（会导致路由/分享 path 不稳定）

## 相关链接

- 配置总览：`/config/`
- JS 配置：`/config/js`
- JSON 配置：`/config/json`
