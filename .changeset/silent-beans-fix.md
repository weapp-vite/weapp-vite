---
"create-weapp-vite": patch
---

移除模板 catalog 中遗留的 `miniprogram-automator` 旧包名，避免脚手架生成项目继续暴露过时依赖标识，统一收敛到 `@weapp-vite/miniprogram-automator` 的现有使用路径。
