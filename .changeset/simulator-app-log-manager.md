---
"@mpcore/simulator": patch
---

对齐微信运行时省略 `App()` 时的默认空应用行为，保留入口异常与显式注册语义；补齐同步 `wx.getLogManager()`，将显式日志接入 Node 和浏览器模拟器的诊断通道。

支持自定义 tabbar 作为页面布局之外的独立组件根节点，通过 `Page.getTabBar()` 访问实例，并为自动化补齐跨根节点 XPath 查询，保持普通 CSS 查询限定在页面内。

对齐页面 ready 生命周期调度，将 onReady 与 onRouteDone 延后到后续宿主任务，让 onLoad/onShow 发起的微任务先完成；初始导航期间已被卸载的页面不再补发 ready 回调。
