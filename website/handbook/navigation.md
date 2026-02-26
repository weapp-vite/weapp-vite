---
title: 页面与路由（导航）
description: 页面与路由（导航），聚焦 handbook / navigation 相关场景，覆盖 Weapp-vite 与 Wevu 的能力、配置和实践要点。
keywords:
  - api
  - handbook
  - navigation
  - 页面与路由（导航）
  - 聚焦
  - /
  - 相关场景
  - 覆盖
---

# 页面与路由（导航）

## 本章你会学到什么

- 小程序导航体系的核心 API 与使用时机
- 参数、页面栈、TabBar 的常见坑

## 你要掌握的导航 API

- `wx.navigateTo`：打开非 tab 页
- `wx.redirectTo`：替换当前页
- `wx.switchTab`：切换 tab
- `wx.reLaunch`：重启到某页
- `wx.navigateBack`：返回

## 参数传递与回跳

- query 参数：注意编码与长度限制
- scene：扫码/分享进入的场景值解析
- 回跳：建议统一封装 `navigateToLoginThenBack()` 这一类工具函数

## 常见坑

- tab 页不能 `navigateTo`
- 页面栈太深导致返回异常：需要用 `redirectTo/reLaunch` 控制栈
