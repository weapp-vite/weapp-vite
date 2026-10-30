---
"@weapp-vite/web": patch
---

fix(web): 统一 WXSS 与内联样式的设备视口和 rpx 换算。

运行时变量模式下，`vw` / `vh` / `vmin` / `vmax` 按设备视口换算，修复宽屏下默认 375px 设备视口中的弹层、遮罩和固定栏溢出。使用 `--weapp-viewport-width` / `--weapp-viewport-height`，后者默认值为 `100dvh`；`pxPerRpx` 静态换算模式保持原有行为。

编译模板与旧字符串模板的动态内联样式共用 WXSS 单位配置，正确处理数组声明、自定义 rpx 变量和静态比例，并保留空值与属性移除行为。

单位转换正确处理嵌套表达式与重复转换；字符串、资源 URL、变量名，以及安全区的显式 fallback 和注释不会被误改。

手动初始化兼容既有 rpx 设计宽度与变量名，显式 `styleUnits` 优先；省略配置时同步重置内联样式转换与根 CSS 变量，空路由也会完成初始化。
