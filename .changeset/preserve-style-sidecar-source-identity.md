---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复连续样式与脚本热更新时把脚本当作 CSS 编译的问题。样式发射使用当前构建依赖图中的实际 sidecar 文件清单，支持同批次多文件更新，并在后续构建清除过期清单，避免诊断信息变化影响构建行为。
