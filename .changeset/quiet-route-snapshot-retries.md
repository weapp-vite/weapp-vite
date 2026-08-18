---
"@weapp-vite/miniprogram-automator": patch
---

修复 App-Service 路由降级元素在页面切换或渲染瞬态窗口中读取空快照的问题，连续查询与样式、尺寸、坐标和属性读取现在会在超时范围内自动重试，降低 DevTools 长序列回归中的偶发失败。
