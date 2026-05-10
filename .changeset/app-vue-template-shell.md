---
"@weapp-core/constants": patch
"create-weapp-vite": patch
"weapp-vite": patch
---

支持在 `src/app.vue` 中编写应用级 `<template>`，并在微信小程序下将其作为内部 app shell 组件包裹页面输出，避免生成无效的 `app.wxml`。
