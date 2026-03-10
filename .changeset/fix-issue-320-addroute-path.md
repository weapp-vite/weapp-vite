---
'wevu': patch
'create-weapp-vite': patch
---

修复 issue #320 e2e 测试页面中 `addRoute` 同名替换验证逻辑：将 `path`（不含前导斜杠）改为 `fullPath`（含前导斜杠）进行路径比较，确保运行时断言与 e2e 测试期望值一致。同时新增 `addRoute` 同名替换的单元测试，覆盖 alias/redirect 替换、旧 alias 清理等场景。
