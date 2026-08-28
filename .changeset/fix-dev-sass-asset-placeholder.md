---
"create-weapp-vite": patch
"weapp-vite": patch
---

修复 dev 样式资产已经包含 Vite URL 占位符时再次进入 Sass 预处理导致无引号 `url(...)` 报未定义变量的问题；仅对占位符中间产物回读原始预处理源码，保持普通 CSS、production 和既有 HMR 输出路径不变。
