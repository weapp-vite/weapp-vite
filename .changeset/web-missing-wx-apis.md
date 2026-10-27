---
"@weapp-vite/web": patch
---

fix(web): 补齐 `hideToast`、`hideShareMenu`、`hideHomeButton`、错误与主题事件监听及 `reportEvent` 的 Web 兼容入口，并在公开导出与各平台全局别名之间复用同一实现。

`onError` 回调接收包含可用堆栈的错误字符串，未处理拒绝事件保留原始 `promise` 和 `reason`。浏览器监听器按首次订阅绑定、最后退订释放；`hideToast` 取消当前关闭定时器，旧回调不会隐藏后来展示的 toast。分享菜单、返回首页按钮和埋点接口仍为兼容调用，不提供微信平台能力。
