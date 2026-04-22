---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复小程序 `.vue` 文件中裸 `import.meta.env` 被展开为多行对象后导致源码调试行号偏移的问题。现在聚合 env 会保持为单行表达式，同时补齐 `issue #475` 的 page/component 回归覆盖，避免页面与组件调试定位再次漂移。
