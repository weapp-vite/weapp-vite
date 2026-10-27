---
"@weapp-vite/web": patch
---

fix(web): wxss 中的 vw/vh 按设备视口换算。

宽屏下运行时会把页面放进居中的设备视口（默认 375px），但 wxss 里的 `1vw` 仍然是浏览器窗口宽度的 1%，全屏弹层、遮罩、fixed 底部栏会按窗口宽度渲染并横向溢出。

- `vw` / `vh` / `vmin` / `vmax` 统一改写为运行时的 `--weapp-viewport-width` / `--weapp-viewport-height`，`vmin` / `vmax` 取两者的 `min()` / `max()`
- 只在运行时变量模式下改写；`pxPerRpx` 静态换算模式保持原样
- `:root` 补充 `--weapp-viewport-height: 100dvh`
- 按标准 CSS token 转换完整尺寸，保留字符串、资源 URL 和变量名，支持带符号、指数、大小写及转义单位；无空格乘法、嵌套表达式与重复转换保持正确
- `rpx` 和安全区也使用相同的 token 边界，避免误改字符串或资源地址；安全区的显式 fallback 与注释保留
