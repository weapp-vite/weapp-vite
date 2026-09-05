---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue 小程序项目在状态保持 HMR 初始构建和增量构建中解析 `@` alias 依赖的问题，确保 alias 模块进入 Rolldown 图并在依赖修改后正确更新。
