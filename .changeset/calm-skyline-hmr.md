---
'create-weapp-vite': patch
'weapp-vite': patch
---

开发模式检测到 Skyline 渲染配置时，提示微信开发者工具的热重载限制，自动关闭项目私有配置中的热重载并降级为 classic，避免修改源码后预览无响应。
