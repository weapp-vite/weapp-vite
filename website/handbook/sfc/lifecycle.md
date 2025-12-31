---
title: 生命周期：页面/组件对齐
---

# 生命周期：页面/组件对齐

## 本章你会学到什么

- 小程序生命周期与 wevu hooks 的对齐关系
- 为什么 hooks 必须在 `setup()` 同步阶段注册

## 页面常用 hooks

- `onShow` / `onHide` / `onReady` / `onUnload`
- `onPageScroll` / `onPullDownRefresh` / `onReachBottom`
- `onShareAppMessage` / `onShareTimeline` / `onAddToFavorites`

详细说明与边界：`/wevu/runtime`

## 常见坑

- 在 `await` 之后注册 hooks（会抛错或失效）
- 分享相关回调不触发：需满足微信官方触发条件（菜单项、`open-type="share"` 等）
