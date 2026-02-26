---
title: 网络请求与数据层
description: 网络请求与数据层，聚焦 handbook / network 相关场景，覆盖 weapp-vite 与 wevu 的能力、配置和实践要点。
keywords:
  - handbook
  - network
  - 网络请求与数据层
  - 聚焦
  - /
  - 相关场景
  - 覆盖
  - weapp-vite
---

# 网络请求与数据层

## 本章你会学到什么

- 统一请求封装的必要字段（超时、重试、鉴权、错误码）
- token 刷新与并发请求的稳妥实现思路

## 推荐分层

- `services/request.ts`：底层封装（`wx.request`、超时、日志、错误转换）
- `services/api/*.ts`：按接口域封装（user/order/pay...）
- `stores/*`：把“请求 + 缓存 + 业务状态”汇总，页面只做编排

## token 刷新（建议要有的能力）

- 401/业务错误码触发刷新 token
- 刷新中把新请求排队，刷新成功后重放
- 刷新失败清理登录态并跳转登录

## 上传/下载

- 上传：注意临时文件路径、进度回调、失败重试
- 下载：注意文件系统配额、清理策略、弱网重试
