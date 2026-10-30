---
"@weapp-vite/web": patch
---

fix(web): 补齐常用 wx 兼容接口，并提示未知模板标签。

增加 `hideToast`、`hideShareMenu`、`hideHomeButton`、`reportEvent`，以及 `onError` / `offError`、`onUnhandledRejection` / `offUnhandledRejection`、`onThemeChange` / `offThemeChange` 兼容入口。公开导出与各平台全局别名保持一致；分享菜单、返回首页按钮和埋点接口仅兼容调用，不提供微信平台能力。

`onError` 接收包含可用堆栈的错误字符串，未处理拒绝事件保留原始 `promise` 和 `reason`；最后一个订阅移除后释放浏览器监听器。

`hideToast` 取消当前关闭定时器，避免旧回调隐藏后来展示的 toast。

编译期提示可能拼写错误或未注册的 WXML 标签，覆盖 `include` / `import` 模板；合法 HTML、SVG、MathML、官方原生组件和编译器导航栏不产生此告警，渲染行为不变。
