---
title: app.(css|scss|wxss|...)
description: 应用级全局样式入口，支持 CSS、WXSS 与常见预处理器后缀。
---

# `app.(css|scss|wxss|...)`

`app.(css|scss|wxss|...)` 是全局样式入口。

## 常见后缀

- `app.css`
- `app.wxss`
- `app.scss`
- `app.less`
- `app.sass`
- `app.styl`

## 常见用途

- reset
- 主题变量
- 公共样式 token
- tabBar、navigation 相关样式

它不是必须文件，但大多数项目值得保留一个全局样式入口。
如果你使用的是 `app.vue`，也可以通过 `<style>` 或 `src="./app.css"` 的方式把它并入 SFC 入口。
