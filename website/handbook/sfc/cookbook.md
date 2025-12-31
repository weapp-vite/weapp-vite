---
title: Cookbook：高频场景配方
---

# Cookbook：高频场景配方

本页把高频需求按“可复制的小片段”组织，后续你可以逐条补充可运行 demo。

## 登录态与拦截跳转

- 统一封装 `ensureLogin()`：未登录先去登录页，成功后回跳
- 结合页面栈：避免重复打开登录页

## 请求队列与 token 刷新

- 401 触发刷新 token
- 刷新期间把新请求排队，刷新完成后重放

## 通用弹窗/Toast 服务

- 把 UI 组件做成 `usingComponents`
- 把“调用入口”做成 service（暴露 `show/close`）

## 列表页模板

- 下拉刷新 + 触底加载 + 空状态 + 错误态 + 骨架屏

## 分享卡片

- `onShareAppMessage` 返回 title/path/imageUrl
- 朋友圈/收藏按需开启菜单项（按微信官方机制）
