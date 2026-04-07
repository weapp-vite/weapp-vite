---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 `weapp-vite` 在开发模式下处理 `.html` 模板热更新时未正确标记入口失效的问题，避免页面与 layout 的模板修改漏掉重编译，并保持 `#415` 的 `FILE_NAME_CONFLICT` 根因修复在更多 HMR 场景下稳定生效。
