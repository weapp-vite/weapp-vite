---
'@mpcore/simulator': patch
---

修复 `@mpcore/simulator` 在真实浏览器环境中的兼容性问题，并新增浏览器 e2e 测试基线。现在 web demo 会暴露稳定的 e2e 调试桥，且 `test:e2e` 可在真实浏览器中验证场景加载、路由跳转、请求、存储与页面事件等核心能力。
