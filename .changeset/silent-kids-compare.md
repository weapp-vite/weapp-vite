---
"create-weapp-vite": patch
---

修复脚手架模板同步与 smoke 校验会误包含 `dist-*` 生成产物的问题，避免本地构建残留进入新创建项目或 npm 包。
