---
"@mpcore/simulator": patch
---

修复模拟器未向小程序脚本提供 app.json 宿主 tabBar 配置的问题，使未显式传入 tabBarEntries 的 wevu 路由可以识别 tabBar 页面。
