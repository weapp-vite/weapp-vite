---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 外部样式的 CSS 变量绑定发生替换、删除或恢复时，按注册能力边界直接切换到 classic，避免原生增量为空时遗漏脚本注册更新。保持绑定不变的普通样式更新继续使用现有热更新能力。
