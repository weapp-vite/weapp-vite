---
"@mpcore/simulator": patch
---

fix(simulator): 补齐常用 wx API，并修正启动与组件查询行为。

支持 `wx.login`、`wx.getAccountInfoSync`、`wx.arrayBufferToBase64` 和 `wx.base64ToArrayBuffer`，提供会话级登录 mock 与账号信息配置。

冷启动导航的 `success` / `complete` 在 App 启动栈退出后、目标页面 ready 前交付。

区分 WXML 裸属性与显式空字符串，让未限定类型的属性在 Node 与浏览器模拟器中接收正确的布尔值，并保留空值与默认值行为。

修复未投影组件自身节点查询的作用域和零尺寸结果，在挂载完成后交付查询回调；回调仍可省略，组件销毁后取消尚未派发的回调。
