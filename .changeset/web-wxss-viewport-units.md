---
"@weapp-vite/web": patch
---

fix(web): wxss 中的 vw/vh 按设备视口换算。

宽屏下运行时会把页面放进居中的设备视口（默认 375px），但 wxss 里的 `1vw` 仍然是浏览器窗口宽度的 1%，全屏弹层、遮罩、fixed 底部栏会按窗口宽度渲染并横向溢出。

- `vw` / `vh` / `vmin` / `vmax` 统一改写为运行时的 `--weapp-viewport-width` / `--weapp-viewport-height`，`vmin` / `vmax` 取两者的 `min()` / `max()`
- 只在运行时变量模式下改写；`pxPerRpx` 静态换算模式保持原样
- `:root` 补充 `--weapp-viewport-height: 100dvh`
